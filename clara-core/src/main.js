/**
 * Clara Core v0.15.1 — Clara State patch roundtrip + Schedule-X als view.
 *
 * Roundtrip: Schedule-X drag/resize (@schedule-x/drag-and-drop, @schedule-x/resize) vuurt
 * `callbacks.onEventUpdate` af → `scheduleXEventToAgendaItemUpdatePatch` → `applyClaraStatePatch`.
 * Daarna opnieuw `calendar.events.set(...)` vanuit Clara State (guard `applyingFromState` voorkomt loops).
 * Testknop \"+30 min (eerste item)\" gebruikt dezelfde patchlaag zonder op DnD te vertrouwen.
 *
 * Later: persistence + ChatGPT/analyze → patches (geen AI in deze stap).
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

async function loadClaraState() {
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

  let runtimeState = structuredClone(await loadClaraState())
  /** @type {{ type: string, id?: string, at: string } | null} */
  let lastPatch = null
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
    metricsEl.textContent = `agenda_items: ${n} · updated_at: ${runtimeState.updated_at ?? '—'} · laatste patch: ${patchLine}`
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

  function applyPatch(patch) {
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
        try {
          const patch = scheduleXEventToAgendaItemUpdatePatch(ev)
          applyPatch(patch)
        } catch (err) {
          console.error(err)
          if (statusEl) {
            statusEl.textContent = err instanceof Error ? err.message : String(err)
          }
        }
      },
    },
  })
  calendar.setTheme('dark')
  calendar.render(host)

  if (shiftBtn) {
    shiftBtn.addEventListener('click', () => {
      const first = runtimeState.agenda_items?.[0]
      if (!first) return
      const patch = buildShiftAgendaItemMinutesPatch(runtimeState, first.id, 30)
      applyPatch(patch)
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
