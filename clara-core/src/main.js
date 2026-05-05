/**
 * Clara Core v0.15.3 — Clara State API + analyze → patchvoorstellen (expliciet toepassen).
 *
 * Analyze: POST /api/clara-analyze (OpenAI als OPENAI_API_KEY, anders rule-based fallback).
 * Patches worden niet blind toegepast: gebruiker kiest "Toepassen" → POST /api/clara-state/patch.
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
  if (patch.note?.id != null) return String(patch.note.id)
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
  const chatInput = document.getElementById('chat-input')
  const analyzeBtn = document.getElementById('chat-analyze')
  const analyzePanel = document.getElementById('analyze-panel')
  const analyzeSummary = document.getElementById('analyze-summary')
  const analyzePatches = document.getElementById('analyze-patches')
  const analyzeApply = document.getElementById('analyze-apply')
  const analyzeDismiss = document.getElementById('analyze-dismiss')

  let runtimeState = structuredClone(await loadInitialState())
  /** @type {{ type: string, id?: string, at: string } | null} */
  let lastPatch = null
  /** @type {string | null} */
  let apiWarning = null
  let applyingFromState = false
  /** @type {ReturnType<typeof createCalendar> | null} */
  let calendar = null
  /** @type {object[] | null} */
  let pendingProposedPatches = null

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

  function hideAnalyzePanel() {
    pendingProposedPatches = null
    if (analyzePanel) analyzePanel.hidden = true
    if (analyzeSummary) analyzeSummary.textContent = ''
    if (analyzePatches) analyzePatches.textContent = ''
  }

  function showAnalyzePanel(summary, patches, questions, warnings) {
    pendingProposedPatches = patches
    if (!analyzePanel) return
    analyzePanel.hidden = false
    if (analyzeSummary) {
      const q = (questions ?? []).length ? `\nVragen: ${(questions ?? []).join(' | ')}` : ''
      const w = (warnings ?? []).length ? `\nWaarschuwingen: ${(warnings ?? []).join(' | ')}` : ''
      analyzeSummary.textContent = `${summary}${q}${w}`
    }
    if (analyzePatches) {
      analyzePatches.textContent = JSON.stringify(patches ?? [], null, 2)
    }
  }

  /**
   * @param {object[]} patches
   */
  async function applyPatchesWithApi(patches) {
    if (!patches?.length) return
    const snapshot = structuredClone(runtimeState)
    apiWarning = null
    try {
      let next = runtimeState
      for (const p of patches) {
        next = applyClaraStatePatch(next, p)
      }
      runtimeState = next
      lastPatch = {
        type: `batch(${patches.length})`,
        at: Temporal.Now.zonedDateTimeISO(DEFAULT_TIMEZONE).toString(),
        id: undefined,
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
        body: JSON.stringify({ patches, source: 'clara-core' }),
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
        type: `batch(${patches.length})`,
        at: data.state?.updated_at ?? lastPatch.at,
        id: undefined,
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

  async function applyPatchWithApi(patch) {
    await applyPatchesWithApi([patch])
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

  if (analyzeBtn && chatInput) {
    analyzeBtn.addEventListener('click', () => {
      void (async () => {
        const input = String(chatInput.value ?? '').trim()
        if (!input) return
        try {
          const res = await fetch('/api/clara-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input,
              state: runtimeState,
              source: 'clara-core',
            }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data?.ok) {
            showAnalyzePanel(data?.error || `Analyze mislukt (${res.status})`, [], [], [])
            pendingProposedPatches = []
            return
          }
          showAnalyzePanel(data.summary ?? '', data.patches ?? [], data.questions ?? [], data.warnings ?? [])
        } catch (e) {
          showAnalyzePanel(e instanceof Error ? e.message : String(e), [], [], [])
          pendingProposedPatches = []
        }
      })()
    })
  }

  if (analyzeDismiss) {
    analyzeDismiss.addEventListener('click', () => {
      hideAnalyzePanel()
    })
  }

  if (analyzeApply) {
    analyzeApply.addEventListener('click', () => {
      void (async () => {
        const list = pendingProposedPatches
        if (!list?.length) return
        await applyPatchesWithApi(list)
        hideAnalyzePanel()
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
