/**
 * Clara Core v0.15.4.1 — calendar-first werkplek + analyze/patch (ongewijzigd functioneel).
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

/**
 * @param {object} patch
 * @param {object} [state]
 */
function patchToHumanLine(patch, state) {
  const agenda = state?.agenda_items ?? []
  const agendaById = (id) => agenda.find((a) => String(a.id) === String(id))
  switch (patch.type) {
    case 'task.create':
      return `Nieuwe taak: ${patch.task?.title ?? '(zonder titel)'}`
    case 'attention.create':
      return `Aandacht: ${patch.item?.text?.slice(0, 120) ?? ''}`
    case 'note.create':
      return `Notitie: ${patch.note?.text?.slice(0, 120) ?? ''}`
    case 'agenda_item.create':
      return `Nieuw agendablok: ${patch.item?.title ?? '(zonder titel)'} · ${patch.item?.start ?? ''} → ${patch.item?.end ?? ''}`
    case 'agenda_item.update': {
      const cur = agendaById(patch.id)
      const label = cur?.title ? `“${cur.title}”` : `blok ${patch.id}`
      const ch = patch.changes ?? {}
      const bits = []
      if (ch.start != null) bits.push(`start ${ch.start}`)
      if (ch.end != null) bits.push(`einde ${ch.end}`)
      if (ch.title != null) bits.push(`titel “${ch.title}”`)
      if (ch.project != null) bits.push(`project ${ch.project}`)
      return bits.length ? `${label}: ${bits.join(' · ')}` : `${label} bijwerken`
    }
    case 'agenda_item.delete': {
      const cur = agendaById(patch.id)
      return cur?.title ? `Agenda verwijderen: “${cur.title}”` : `Agenda verwijderen · ${patch.id}`
    }
    default:
      return `Onbekend voorstel (${String(patch.type)})`
  }
}

async function loadInitialState() {
  try {
    const res = await fetch('/api/clara-state', { cache: 'no-store' })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    /* geen API in preview */
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

function countAgendaToday(state) {
  const today = Temporal.Now.zonedDateTimeISO(DEFAULT_TIMEZONE).toPlainDate().toString()
  return (state.agenda_items ?? []).filter((a) => String(a.start).startsWith(today)).length
}

async function main() {
  const syncEl = document.getElementById('sync-indicator')
  const rangeEl = document.getElementById('topbar-range')
  const debugEl = document.getElementById('state-debug')
  const host = document.getElementById('calendar')
  const shiftBtn = document.getElementById('shift-first-item')
  const composerInput = document.getElementById('composer-input')
  const analyzeBtn = document.getElementById('composer-analyze')
  const drawerTitle = document.getElementById('drawer-title')
  const drawerSubtitle = document.getElementById('drawer-subtitle')
  const drawerBack = document.getElementById('drawer-back')
  const drawerBody = document.getElementById('drawer-body')
  const drawerAnalyzeActions = document.getElementById('drawer-analyze-actions')
  const analyzeApply = document.getElementById('analyze-apply')
  const analyzeDismiss = document.getElementById('analyze-dismiss')
  const viewWeekBtn = document.getElementById('view-week')
  const viewDayBtn = document.getElementById('view-day')
  const navPrev = document.getElementById('nav-prev')
  const navNext = document.getElementById('nav-next')
  const composerFocus = document.getElementById('composer-focus')
  const devDialog = document.getElementById('dev-dialog')
  const devClose = document.getElementById('dev-close')

  let runtimeState = structuredClone(await loadInitialState())
  let apiWarning = null
  let applyingFromState = false
  /** @type {ReturnType<typeof createCalendar> | null} */
  let calendar = null
  let pendingProposedPatches = null
  /** @type {'week' | 'day'} */
  let viewMode = 'week'
  /** @type {'home' | 'calendar' | 'tasks' | 'notes' | 'clara' | 'event' | 'analyze'} */
  let drawerMode = 'home'
  /** @type {object | null} */
  let selectedEvent = null

  function nAgenda() {
    return (runtimeState.agenda_items ?? []).length
  }

  function updateSyncPill() {
    if (!syncEl) return
    const warn = apiWarning ? ' · let op' : ''
    syncEl.textContent = `Clara State · ${nAgenda()} agenda${warn}`.slice(0, 72)
    syncEl.classList.toggle('is-warn', Boolean(apiWarning))
    syncEl.classList.toggle('is-ok', !apiWarning)
  }

  function updateRangeLabel() {
    if (!calendar?.$app || !rangeEl) return
    const r = calendar.$app.calendarState.range.value
    if (r?.start && r?.end) {
      rangeEl.textContent = `${r.start} – ${r.end}`
    }
  }

  function renderDebug() {
    if (debugEl) {
      debugEl.textContent = JSON.stringify(runtimeState, null, 2)
    }
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

  function setDrawerAnalyzeActionsVisible(visible) {
    if (!drawerAnalyzeActions) return
    drawerAnalyzeActions.classList.toggle('hidden', !visible)
  }

  /**
   * @param {string} title
   * @param {string} [subtitle]
   * @param {boolean} [showBack]
   */
  function setDrawerHead(title, subtitle = '', showBack = false) {
    if (drawerTitle) drawerTitle.textContent = title
    if (drawerSubtitle) drawerSubtitle.textContent = subtitle
    if (drawerBack) drawerBack.hidden = !showBack
  }

  function goDrawerHome() {
    if (drawerMode === 'analyze') {
      hideAnalyzeDrawer()
      return
    }
    selectedEvent = null
    drawerMode = 'home'
    setRailActive('home')
    renderDrawer()
  }

  function renderDrawer() {
    if (!drawerTitle || !drawerBody) return

    if (drawerMode === 'analyze') {
      setDrawerHead('Analyze', 'Voorstellen op basis van je invoer', true)
      setDrawerAnalyzeActionsVisible(true)
      return
    }
    setDrawerAnalyzeActionsVisible(false)

    if (drawerMode === 'event' && selectedEvent) {
      setDrawerHead('Agendablok', 'Detail uit de kalender', true)
      const proj = selectedEvent.calendarId != null ? String(selectedEvent.calendarId) : ''
      drawerBody.innerHTML = `
        <div class="stack drawer-stack--event">
          <div class="drawer-section"><p class="kicker">Titel</p><p class="drawer-lead">${escapeHtml(String(selectedEvent.title ?? ''))}</p></div>
          <div class="drawer-section"><p class="kicker">Tijd</p><p class="muted">${escapeHtml(String(selectedEvent.start ?? ''))} → ${escapeHtml(String(selectedEvent.end ?? ''))}</p></div>
          ${proj ? `<div class="drawer-section"><p class="kicker">Project</p><p class="muted">${escapeHtml(proj)}</p></div>` : ''}
        </div>`
      return
    }

    if (drawerMode === 'tasks') {
      setDrawerHead('Taken', 'Clara State', true)
      const tasks = runtimeState.tasks ?? []
      drawerBody.innerHTML =
        tasks.length === 0
          ? '<p class="muted">Nog geen taken in Clara State.</p>'
          : `<ul class="list">${tasks.map((t) => `<li>${escapeHtml(String(t.title ?? t.id))}</li>`).join('')}</ul>`
      return
    }

    if (drawerMode === 'notes') {
      setDrawerHead('Notities', 'Clara State', true)
      const notes = runtimeState.notes ?? []
      drawerBody.innerHTML =
        notes.length === 0
          ? '<p class="muted">Nog geen notities.</p>'
          : `<ul class="list">${notes.map((n) => `<li>${escapeHtml(String(n.text ?? n.id))}</li>`).join('')}</ul>`
      return
    }

    if (drawerMode === 'clara') {
      setDrawerHead('Clara', 'Denklaag', true)
      drawerBody.innerHTML =
        '<p class="muted">Clara is de denklaag. Gebruik de invoerbalk hieronder om tekst te laten analyseren — voorstellen verschijnen in dit paneel.</p>'
      return
    }

    if (drawerMode === 'calendar') {
      setDrawerHead('Agenda', 'Kalender + state', true)
      drawerBody.innerHTML =
        '<p class="muted">De kalender is je hoofdcanvas. Sleep of resize een blok om Clara State bij te werken (via API).</p>'
      return
    }

    /* home */
    setDrawerHead('Vandaag', '', false)
    const todayCount = countAgendaToday(runtimeState)
    const pending = (pendingProposedPatches ?? []).length
    const q = (runtimeState.conversation_context?.summary && String(runtimeState.conversation_context.summary)) || ''
    drawerBody.innerHTML = `
      <div class="stack drawer-stack--home">
        <section class="drawer-section">
          <p class="kicker">Vandaag</p>
          <p>${todayCount} blok(ken) vandaag · ${nAgenda()} totaal in agenda</p>
        </section>
        <section class="drawer-section">
          <p class="kicker">Focus</p>
          <p class="muted">Kies een blok in de kalender voor details, of gebruik Analyze voor voorstellen.</p>
        </section>
        <section class="drawer-section">
          <p class="kicker">Voorstellen</p>
          ${
            pending
              ? `<p>${pending} voorstel(len) in Analyze — heropen via de invoer hieronder.</p>`
              : `<div class="empty-state empty-state--inline"><p class="empty-state-title">Geen openstaande voorstellen</p><p class="empty-state-hint">Analyze toont hier eventuele patch-stappen.</p></div>`
          }
        </section>
        <section class="drawer-section">
          <p class="kicker">Context</p>
          <p class="muted">${escapeHtml(q.slice(0, 280)) || '—'}</p>
        </section>
      </div>`
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function showAnalyzeInDrawer(summary, patches, questions, warnings) {
    pendingProposedPatches = patches
    drawerMode = 'analyze'
    setDrawerHead('Analyze', 'Voorstellen op basis van je invoer', true)
    const lines = (patches ?? [])
      .map((p) => `<li class="proposal-line">${escapeHtml(patchToHumanLine(p, runtimeState))}</li>`)
      .join('')
    const qs = (questions ?? []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')
    const ws = (warnings ?? []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')
    const hasPatches = Boolean((patches ?? []).length)
    if (drawerBody) {
      drawerBody.innerHTML = `
        <div class="stack drawer-stack--analyze">
          <section class="drawer-section drawer-zone">
            <p class="kicker">Samenvatting</p>
            <p class="analyze-summary">${escapeHtml(summary || '—')}</p>
          </section>
          <section class="drawer-section drawer-zone">
            <p class="kicker">Voorstellen</p>
            ${
              hasPatches
                ? `<ul class="list proposal-list">${lines}</ul>`
                : `<div class="empty-state"><p class="empty-state-title">Geen voorgestelde wijzigingen</p><p class="empty-state-hint">Clara heeft geen concrete patch-stappen. Pas je invoer aan of werk verder in de kalender.</p></div>`
            }
          </section>
          ${qs ? `<section class="drawer-section drawer-zone"><p class="kicker">Vragen</p><ul class="list">${qs}</ul></section>` : ''}
          ${ws ? `<section class="drawer-section drawer-zone drawer-zone--warn"><p class="kicker">Waarschuwingen</p><ul class="list">${ws}</ul></section>` : ''}
        </div>`
    }
    setDrawerAnalyzeActionsVisible(hasPatches)
    setRailActive('home')
  }

  function hideAnalyzeDrawer() {
    pendingProposedPatches = null
    drawerMode = 'home'
    setDrawerAnalyzeActionsVisible(false)
    renderDrawer()
  }

  function setRailActive(mode) {
    document.querySelectorAll('.rail-btn[data-drawer]').forEach((btn) => {
      const m = /** @type {HTMLElement} */ (btn).dataset.drawer
      btn.classList.toggle('is-active', m === mode)
    })
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
      renderDebug()
      updateSyncPill()
      syncCalendarFromState()

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
      apiWarning = null
    } catch (err) {
      runtimeState = snapshot
      apiWarning = err instanceof Error ? err.message : String(err)
    }
    renderDebug()
    updateSyncPill()
    syncCalendarFromState()
    renderDrawer()
  }

  async function applyPatchWithApi(patch) {
    await applyPatchesWithApi([patch])
  }

  function rebuildCalendar() {
    let preserveDate = null
    if (calendar?.$app) {
      try {
        preserveDate = calendar.$app.datePickerState.selectedDate.value
      } catch {
        preserveDate = null
      }
    }
    if (calendar) {
      calendar.destroy()
      calendar = null
    }
    const initialEvents = mapClaraAgendaItemsToScheduleXEvents(runtimeState.agenda_items)
    const views =
      viewMode === 'day'
        ? [createViewDay(), createViewList()]
        : [createViewWeek(), createViewList()]
    const selectedDate =
      preserveDate ?? pickInitialPlainDate(initialEvents).toString()

    calendar = createCalendar({
      views,
      events: initialEvents,
      selectedDate,
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
              updateSyncPill()
            }
          })()
        },
        onEventClick: (ev) => {
          selectedEvent = ev
          drawerMode = 'event'
          document.querySelectorAll('.rail-btn[data-drawer]').forEach((b) => b.classList.remove('is-active'))
          renderDrawer()
        },
        onRangeUpdate: () => {
          updateRangeLabel()
        },
      },
    })
    calendar.setTheme('dark')
    calendar.render(host)
    syncCalendarFromState()
    requestAnimationFrame(() => updateRangeLabel())
  }

  rebuildCalendar()

  function setViewMode(mode) {
    viewMode = mode
    if (viewWeekBtn && viewDayBtn) {
      viewWeekBtn.classList.toggle('is-active', mode === 'week')
      viewDayBtn.classList.toggle('is-active', mode === 'day')
    }
    rebuildCalendar()
  }

  viewWeekBtn?.addEventListener('click', () => setViewMode('week'))
  viewDayBtn?.addEventListener('click', () => setViewMode('day'))

  function stepNav(deltaDays) {
    if (!calendar?.$app) return
    const step = viewMode === 'week' ? 7 : 1
    const cur = calendar.$app.datePickerState.selectedDate.value
    const next = Temporal.PlainDate.from(cur).add({ days: deltaDays * step }).toString()
    calendar.$app.calendarState.setRange(next)
    updateRangeLabel()
  }

  navPrev?.addEventListener('click', () => stepNav(-1))
  navNext?.addEventListener('click', () => stepNav(1))

  document.querySelectorAll('.rail-btn[data-drawer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = /** @type {HTMLElement} */ (btn).dataset.drawer
      if (!mode) return
      drawerMode = /** @type {typeof drawerMode} */ (mode)
      selectedEvent = null
      setRailActive(mode)
      renderDrawer()
    })
  })

  document.querySelector('.rail-btn[data-action="dev"]')?.addEventListener('click', () => {
    renderDebug()
    devDialog?.showModal()
  })

  devClose?.addEventListener('click', () => devDialog?.close())

  drawerBack?.addEventListener('click', () => {
    goDrawerHome()
  })

  composerFocus?.addEventListener('click', () => {
    composerInput?.focus()
  })

  shiftBtn?.addEventListener('click', () => {
    void (async () => {
      const first = runtimeState.agenda_items?.[0]
      if (!first) return
      const patch = buildShiftAgendaItemMinutesPatch(runtimeState, first.id, 30)
      await applyPatchWithApi(patch)
    })()
  })

  composerInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    if (e.shiftKey) return
    e.preventDefault()
    analyzeBtn?.click()
  })

  analyzeBtn?.addEventListener('click', () => {
    void (async () => {
      const input = String(composerInput?.value ?? '').trim()
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
          showAnalyzeInDrawer(data?.error || `Analyze mislukt (${res.status})`, [], [], [])
          pendingProposedPatches = []
          setDrawerAnalyzeActionsVisible(false)
          return
        }
        showAnalyzeInDrawer(data.summary ?? '', data.patches ?? [], data.questions ?? [], data.warnings ?? [])
      } catch (e) {
        showAnalyzeInDrawer(e instanceof Error ? e.message : String(e), [], [], [])
        pendingProposedPatches = []
        setDrawerAnalyzeActionsVisible(false)
      }
    })()
  })

  analyzeDismiss?.addEventListener('click', () => {
    hideAnalyzeDrawer()
  })

  analyzeApply?.addEventListener('click', () => {
    void (async () => {
      const list = pendingProposedPatches
      if (!list?.length) return
      await applyPatchesWithApi(list)
      hideAnalyzeDrawer()
    })()
  })

  renderDebug()
  updateSyncPill()
  renderDrawer()
}

main().catch((err) => {
  console.error(err)
  const syncEl = document.getElementById('sync-indicator')
  const debugEl = document.getElementById('state-debug')
  if (syncEl) {
    syncEl.textContent = err instanceof Error ? err.message : String(err)
    syncEl.classList.add('is-warn')
  }
  if (debugEl) {
    debugEl.textContent = err instanceof Error ? err.stack ?? err.message : String(err)
  }
})
