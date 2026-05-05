/**
 * Clara Core v0.15.2 — Clara State API (GET/POST) + Schedule-X view.
 *
 * Initial load: probeert GET /api/clara-state; faalt dat → seed `/core.json`.
 * Wijzigingen (DnD/resize/testknop): lokaal `applyClaraStatePatch` → POST /api/clara-state/patch;
 * bij succes `response.state`; bij fout rollback + compacte API-waarschuwing in metrics.
 *
 * Dev: Vite middleware serveert `/api/*` en schrijft naar CLARA_STATE/core.json.
 * Productie (Vercel): zelfde routes; schrijven kan falen op read-only FS — zie README.
 */
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import { createCalendar, createViewDay, createViewList, createViewWeek } from '@schedule-x/calendar'
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop'
import { createResizePlugin } from '@schedule-x/resize'
import { applyClaraStatePatch, buildShiftAgendaItemMinutesPatch } from './claraStatePatch.js'
import {
  DEFAULT_TIMEZONE,
  mapClaraAgendaItemsToScheduleXEvents,
} from './mapClaraAgendaToScheduleX.js'
import { scheduleXEventToAgendaItemUpdatePatch } from './scheduleXToClaraPatch.js'

function patchIdForDisplay(patch) {
  if (patch.id != null) return String(patch.id)
  if (patch.item?.id != null) return String(patch.item.id)
  if (patch.task?.id != null) return String(patch.task.id)
  return undefined
}

async function loadInitialState() {
  try {
    const res = await fetch('/api/clara-state', { cache: 'no-store' })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    /* netwerk / geen dev-middleware */
  }
  const res = await fetch('/core.json', { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`Kon Clara State niet laden (${res.status})`)
  }
  return res.json()
}

function pickInitialPlainDate(events) {
  if (events.length > 0) {
    const first = events[0].start
    if (first && typeof first.toPlainDate === 'function') {
      return first.toPlainDate()
    }
  }
  return Temporal.Now.zonedDateTimeISO(DEFAULT_TIMEZONE).toPlainDate()
}

async function main() {
  const statusEl = document.getElementById('header-status')
  const debugEl = document.getElementById('state-debug')
  const host = document.getElementById('calendar')
  const metricsEl = document.getElementById('state-metrics')
  const shiftBtn = document.getElementById('shift-first-item')

  let runtimeState = structuredClone(await loadInitialState())
  /** @type {{ type: string, id?: string, at: string } | null} */
  let lastPatch = null
  /** @type {string | null} */
  let apiWarning = null
  let applyingFromState = false
  /** @type {ReturnType<typeof createCalendar> | null} */
  let calendar = null

  function renderDebug() {
    if (debugEl) {
      debugEl.textContent = JSON.stringify(runtimeState, null, 2)
    }
  }

  function renderMetrics() {
    if (!metricsEl) return
    const n = (runtimeState.agenda_items ?? []).length
    const patchLine = lastPatch
      ? `${lastPatch.type}${lastPatch.id != null ? ` · ${lastPatch.id}` : ''} · ${lastPatch.at}`
      : '—'
    const apiLine = apiWarning ? `API-waarschuwing: ${apiWarning}` : 'API: gesynchroniseerd'
    metricsEl.textContent = `agenda_items: ${n} · updated_at: ${runtimeState.updated_at ?? '—'} · laatste patch: ${patchLine}\n${apiLine}`
  }

  function syncCalendarFromState() {
    if (!calendar) return
    const events = mapClaraAgendaItemsToScheduleXEvents(runtimeState.agenda_items)
    applyingFromState = true
    try {
      calendar.events.set(events)
    } finally {
      queueMicrotask(() => {
        applyingFromState = false
      })
    }
  }

  /**
   * Optimistische patch + persist; rollback bij API-fout.
   * @param {object} patch
   */
  async function applyPatchWithApi(patch) {
    const snapshot = structuredClone(runtimeState)
    apiWarning = null
    try {
      runtimeState = applyClaraStatePatch(runtimeState, patch)
      lastPatch = {
        type: patch.type,
        at: Temporal.Now.zonedDateTimeISO(DEFAULT_TIMEZONE).toString(),
        id: patchIdForDisplay(patch),
      }
      renderDebug()
      renderMetrics()
      syncCalendarFromState()
      if (statusEl) {
        statusEl.textContent = `Clara State leidend · Schedule-X = view · ${nAgenda()} items · Europe/Amsterdam`
      }

      const res = await fetch('/api/clara-state/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, source: 'clara-core' }),
      })
      const raw = await res.text()
      let data
      try {
        data = JSON.parse(raw || '{}')
      } catch {
        data = null
      }
      if (!res.ok || !data?.ok) {
        const msg = (data && data.error) || raw || `HTTP ${res.status}`
        throw new Error(msg)
      }
      runtimeState = data.state
      lastPatch = {
        type: patch.type,
        at: data.state?.updated_at ?? lastPatch.at,
        id: patchIdForDisplay(patch),
      }
      apiWarning = null
    } catch (err) {
      runtimeState = snapshot
      lastPatch = null
      apiWarning = err instanceof Error ? err.message : String(err)
    }
    renderDebug()
    renderMetrics()
    syncCalendarFromState()
    if (statusEl) {
      statusEl.textContent = `Clara State leidend · Schedule-X = view · ${nAgenda()} items · Europe/Amsterdam`
    }
  }

  function nAgenda() {
    return (runtimeState.agenda_items ?? []).length
  }

  const initialEvents = mapClaraAgendaItemsToScheduleXEvents(runtimeState.agenda_items)

  calendar = createCalendar({
    views: [createViewDay(), createViewWeek(), createViewList()],
    events: initialEvents,
    selectedDate: pickInitialPlainDate(initialEvents),
    plugins: [createDragAndDropPlugin(15), createResizePlugin(15)],
    callbacks: {
      onEventUpdate: (ev) => {
        if (applyingFromState) return
        void (async () => {
          try {
            const patch = scheduleXEventToAgendaItemUpdatePatch(ev)
            await applyPatchWithApi(patch)
          } catch (err) {
            console.error(err)
            apiWarning = err instanceof Error ? err.message : String(err)
            renderMetrics()
          }
        })()
      },
    },
  })
  calendar.setTheme('dark')
  calendar.render(host)

  if (shiftBtn) {
    shiftBtn.addEventListener('click', () => {
      void (async () => {
        const first = runtimeState.agenda_items?.[0]
        if (!first) return
        const patch = buildShiftAgendaItemMinutesPatch(runtimeState, first.id, 30)
        await applyPatchWithApi(patch)
      })()
    })
  }

  renderDebug()
  renderMetrics()
  if (statusEl) {
    statusEl.textContent = `Clara State leidend · Schedule-X = view · ${nAgenda()} items · Europe/Amsterdam`
  }
}

main().catch((err) => {
  console.error(err)
  const statusEl = document.getElementById('header-status')
  const debugEl = document.getElementById('state-debug')
  if (statusEl) {
    statusEl.textContent = err instanceof Error ? err.message : String(err)
  }
  if (debugEl) {
    debugEl.textContent = err instanceof Error ? err.stack ?? err.message : String(err)
  }
})
