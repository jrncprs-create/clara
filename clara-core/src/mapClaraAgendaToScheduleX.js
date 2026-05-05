/**
 * Mapping: Clara State → Schedule-X
 *
 * Clara State (`agenda_items`) is leidend. Schedule-X-events zijn alleen een
 * kalenderweergave en mogen niet als bron van waarheid worden gebruikt.
 */

export const DEFAULT_TIMEZONE = 'Europe/Amsterdam'

/**
 * @param {{ id: string, title: string, start: string, end: string, project?: string, status?: string, kind?: string }} item
 * @param {{ defaultCalendarId?: string }} [options]
 */
export function mapClaraAgendaItemToScheduleXEvent(item, { defaultCalendarId = 'default' } = {}) {
  const zone = DEFAULT_TIMEZONE
  const start = Temporal.ZonedDateTime.from(`${item.start}[${zone}]`)
  const end = Temporal.ZonedDateTime.from(`${item.end}[${zone}]`)
  return {
    id: String(item.id),
    title: item.title,
    start,
    end,
    calendarId: item.project != null ? String(item.project) : defaultCalendarId,
  }
}

/** @param {Array<{ id: string, title: string, start: string, end: string, project?: string }> | undefined} items */
export function mapClaraAgendaItemsToScheduleXEvents(items, options) {
  return (items ?? []).map((item) => mapClaraAgendaItemToScheduleXEvent(item, options))
}
