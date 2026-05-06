/**
 * Mapping: Clara State → Schedule-X
 *
 * Clara State (`agenda_items`) is leidend. Schedule-X-events zijn alleen een
 * kalenderweergave en mogen niet als bron van waarheid worden gebruikt.
 *
 * Schedule-X valideert events als `YYYY-MM-DD HH:mm` (of alleen datum); geen
 * Temporal ZonedDateTime-string met `[Europe/Amsterdam]`-suffix.
 */

export const DEFAULT_TIMEZONE = 'Europe/Amsterdam'

/** Schedule-X `dateTimeStringRegex`: minuutprecisie, 00–23 uur. */
const SCHEDULE_X_DATETIME = /^(\d{4}-\d{2}-\d{2}) (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/

/**
 * Zet Clara agenda-tijd (plain, offset, of ZonedDateTime-ISO) om naar
 * `YYYY-MM-DD HH:mm` in {@link DEFAULT_TIMEZONE}-wandtijd.
 * @param {string} isoLike
 * @param {string} [zone]
 * @returns {string}
 */
export function claraAgendaTimeToScheduleXDateTime(isoLike, zone = DEFAULT_TIMEZONE) {
  const raw = String(isoLike).trim()
  if (SCHEDULE_X_DATETIME.test(raw)) return raw

  /** @type {Temporal.ZonedDateTime} */
  let zdt
  if (/\[[^\]]+\]\s*$/.test(raw)) {
    zdt = Temporal.ZonedDateTime.from(raw)
  } else {
    zdt = Temporal.ZonedDateTime.from(`${raw}[${zone}]`)
  }

  const local = zdt.withTimeZone(zone)
  const p = local.toPlainDateTime()
  const d = local.toPlainDate().toString()
  const hh = String(p.hour).padStart(2, '0')
  const mm = String(p.minute).padStart(2, '0')
  return `${d} ${hh}:${mm}`
}

/**
 * @param {{ id: string, title: string, start: string, end: string, project?: string, status?: string, kind?: string }} item
 * @param {{ defaultCalendarId?: string }} [options]
 */
export function mapClaraAgendaItemToScheduleXEvent(item, { defaultCalendarId = 'default' } = {}) {
  const zone = DEFAULT_TIMEZONE
  const start = claraAgendaTimeToScheduleXDateTime(item.start, zone)
  const end = claraAgendaTimeToScheduleXDateTime(item.end, zone)
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
