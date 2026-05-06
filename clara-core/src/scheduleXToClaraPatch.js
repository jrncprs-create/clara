/**
 * Schedule-X levert UI-events; dit wordt omgezet naar Clara State-patches.
 * Clara State blijft de bron van waarheid — nooit andersom.
 *
 * Events gebruiken `YYYY-MM-DD HH:mm` (Schedule-X-validatie); deze laag zet
 * dat om naar Clara `YYYY-MM-DDTHH:mm:ss` (Europe/Amsterdam-wandtijd).
 */

import { DEFAULT_TIMEZONE } from './mapClaraAgendaToScheduleX.js'

/**
 * Normaliseer Schedule-X tijdwaarde naar Clara `YYYY-MM-DDTHH:mm:ss` (zonder offset; zone Amsterdam).
 * @param {unknown} value
 */
export function eventTimeToClaraPlain(value) {
  if (value == null) {
    throw new Error('eventTimeToClaraPlain: ontbrekende tijd')
  }
  if (typeof value === 'string') {
    const space = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/)
    if (space) {
      const sec = space[3] ?? '00'
      return `${space[1]}T${space[2]}:${sec}`
    }
    if (value.includes('T')) {
      const hasZone = /\[|Z|[+-]\d{2}:?\d{2}$/.test(value)
      const zdt = hasZone
        ? Temporal.ZonedDateTime.from(value)
        : Temporal.ZonedDateTime.from(`${value}[${DEFAULT_TIMEZONE}]`)
      return zdt.withTimeZone(DEFAULT_TIMEZONE).toPlainDateTime().toString()
    }
    throw new Error(`eventTimeToClaraPlain: onherkenbare string ${value}`)
  }
  if (typeof Temporal !== 'undefined' && Temporal.ZonedDateTime && value instanceof Temporal.ZonedDateTime) {
    return value.withTimeZone(DEFAULT_TIMEZONE).toPlainDateTime().toString()
  }
  if (typeof Temporal !== 'undefined' && Temporal.PlainDateTime && value instanceof Temporal.PlainDateTime) {
    return value.toString()
  }
  throw new Error(`eventTimeToClaraPlain: niet-ondersteund type ${typeof value}`)
}

/** @param {{ id: string | number, start: unknown, end: unknown, title?: string }} event */
export function scheduleXEventToAgendaItemUpdatePatch(event) {
  const changes = {
    start: eventTimeToClaraPlain(event.start),
    end: eventTimeToClaraPlain(event.end),
  }
  if (event.title != null) {
    changes.title = String(event.title)
  }
  return {
    type: 'agenda_item.update',
    id: String(event.id),
    changes,
  }
}
