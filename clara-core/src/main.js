/**
 * Clara Core v0.15 — read-only Clara State + Schedule-X.
 *
 * Gepland later (niet nu): drag/drop → Clara State; ChatGPT → state-patch;
 * gedeelde persistentie → centrale Clara State-opslag.
 */
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import { createCalendar, createViewDay, createViewList, createViewWeek } from '@schedule-x/calendar'
import {
  DEFAULT_TIMEZONE,
  mapClaraAgendaItemsToScheduleXEvents,
} from './mapClaraAgendaToScheduleX.js'

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

  try {
    const state = await loadClaraState()
    const events = mapClaraAgendaItemsToScheduleXEvents(state.agenda_items)

    if (debugEl) {
      debugEl.textContent = JSON.stringify(state, null, 2)
    }

    const calendar = createCalendar({
      views: [createViewDay(), createViewWeek(), createViewList()],
      events,
      selectedDate: pickInitialPlainDate(events),
    })
    calendar.setTheme('dark')
    calendar.render(host)

    if (statusEl) {
      statusEl.textContent = `State: ${state.updated_at ?? '—'} · ${events.length} agenda-items (Europe/Amsterdam)`
    }
  } catch (err) {
    console.error(err)
    if (statusEl) {
      statusEl.textContent = err instanceof Error ? err.message : String(err)
    }
    if (debugEl) {
      debugEl.textContent = err instanceof Error ? err.stack ?? err.message : String(err)
    }
  }
}

main()
