const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

const AMSTERDAM_TZ = 'Europe/Amsterdam'
const DUTCH_MONTHS = {
  januari: 1,
  februari: 2,
  maart: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  augustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12
}
const DUTCH_WEEKDAYS = {
  zondag: 0,
  maandag: 1,
  dinsdag: 2,
  woensdag: 3,
  donderdag: 4,
  vrijdag: 5,
  zaterdag: 6
}

function safeString(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  return String(value).trim()
}

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function normalizeWhitespace(str = '') {
  return String(str)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeType(input) {
  const raw = safeString(input).toLowerCase()

  if (['task', 'taak', 'todo', 'to-do'].includes(raw)) return 'taak'
  if (['agenda', 'afspraak', 'event', 'appointment'].includes(raw)) return 'afspraak'
  if (['note', 'notitie', 'notes'].includes(raw)) return 'notitie'
  if (['idea', 'idee', 'ideen'].includes(raw)) return 'idee'
  if (['project', 'projects'].includes(raw)) return 'project'
  if (['beslissing', 'decision'].includes(raw)) return 'beslissing'

  return 'notitie'
}

function getAmsterdamDateParts(baseDate = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  })

  const parts = fmt.formatToParts(baseDate)
  const year = Number(parts.find(p => p.type === 'year')?.value)
  const month = Number(parts.find(p => p.type === 'month')?.value)
  const day = Number(parts.find(p => p.type === 'day')?.value)
  const weekdayShort = safeString(parts.find(p => p.type === 'weekday')?.value).toLowerCase()

  return { year, month, day, weekdayShort }
}

function makeUTCDateFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day))
}

function getAmsterdamTodayUTC(baseDate = new Date()) {
  const { year, month, day } = getAmsterdamDateParts(baseDate)
  return makeUTCDateFromParts(year, month, day)
}

function addDaysUTC(date, days) {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function formatUTCDateYMD(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function getNextWeekdayYMD(targetWeekday, includeToday = false, baseDate = new Date()) {
  const today = getAmsterdamTodayUTC(baseDate)
  const currentWeekday = today.getUTCDay()
  let diff = targetWeekday - currentWeekday

  if (diff < 0 || (!includeToday && diff === 0)) {
    diff += 7
  }

  return formatUTCDateYMD(addDaysUTC(today, diff))
}

function normalizeExplicitDateString(raw) {
  const value = safeString(raw)
  if (!value) return ''

  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  match = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  return ''
}

function extractRelativeDateFromText(text, baseDate = new Date()) {
  const raw = safeString(text).toLowerCase()
  if (!raw) return ''

  const today = getAmsterdamTodayUTC(baseDate)

  if (/\bovermorgen\b/.test(raw)) {
    return formatUTCDateYMD(addDaysUTC(today, 2))
  }

  if (/\bmorgen\b/.test(raw)) {
    return formatUTCDateYMD(addDaysUTC(today, 1))
  }

  if (/\bvandaag\b/.test(raw)) {
    return formatUTCDateYMD(today)
  }

  for (const [weekdayName, weekdayIndex] of Object.entries(DUTCH_WEEKDAYS)) {
    const weekdayRegex = new RegExp(`\\b${weekdayName}\\b`, 'i')
    const upcomingRegex = /\b(a\.s\.|as|aanstaande|komende)\b/i

    if (weekdayRegex.test(raw) && upcomingRegex.test(raw)) {
      return getNextWeekdayYMD(weekdayIndex, false, baseDate)
    }
  }

  return ''
}

function extractExplicitDateFromText(text, baseDate = new Date()) {
  const raw = safeString(text).toLowerCase()
  if (!raw) return ''

  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}-\d{1,2}-\d{4}\b/,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
    /\b\d{1,2}\.\d{1,2}\.\d{4}\b/
  ]

  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match) {
      const normalized = normalizeExplicitDateString(match[0])
      if (normalized) return normalized
    }
  }

  const textual = raw.match(
    /\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+(\d{4}))?\b/i
  )

  if (textual) {
    const day = Number(textual[1])
    const month = DUTCH_MONTHS[textual[2].toLowerCase()]
    const currentYear = getAmsterdamDateParts(baseDate).year
    const year = textual[3] ? Number(textual[3]) : currentYear

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  return ''
}

function normalizeDate(input, baseDate = new Date()) {
  const raw = safeString(input)
  if (!raw) return ''

  const explicit = normalizeExplicitDateString(raw)
  if (explicit) return explicit

  const relative = extractRelativeDateFromText(raw, baseDate)
  if (relative) return relative

  const embeddedExplicit = extractExplicitDateFromText(raw, baseDate)
  if (embeddedExplicit) return embeddedExplicit

  return ''
}

function normalizeTime(input) {
  const raw = safeString(input).toLowerCase().replace(/\./g, ':')
  if (!raw) return ''

  if (/^\d{1,2}$/.test(raw)) {
    const hh = Number(raw)
    if (hh >= 0 && hh <= 23) return `${pad2(hh)}:00`
  }

  const match = raw.match(/^(\d{1,2}):(\d{1,2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  return ''
}

function extractTimeFromText(text) {
  const raw = safeString(text).toLowerCase().replace(/\./g, ':')
  if (!raw) return ''

  let match = raw.match(/\b(\d{1,2}):(\d{2})\b/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  match = raw.match(/\bom\s+(\d{1,2})\b/)
  if (match) {
    const hh = Number(match[1])
    if (hh >= 0 && hh <= 23) return `${pad2(hh)}:00`
  }

  match = raw.match(/\b(?:om\s*)?(\d{1,2})\s*uur\b/)
  if (match) {
    const hh = Number(match[1])
    if (hh >= 0 && hh <= 23) return `${pad2(hh)}:00`
  }

  return ''
}

function fixCommonTypos(input = '') {
  let text = String(input)

  const replacements = [
    [/\bdfremel\b/gi, 'dremel'],
    [/\bdremel`?1\b/gi, 'dremel'],
    [/\bfiuller\b/gi, 'filler'],
    [/\biun\b/gi, 'in'],
    [/\bdaty\b/gi, 'date'],
    [/\bgeen gekleurde fiuller\b/gi, 'geen gekleurde filler'],
    [/\bmet de dfremel\b/gi, 'met de dremel'],
    [/`1/g, '']
  ]

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement)
  }

  return normalizeWhitespace(text)
}

function stripMetaPhrases(input = '') {
  return normalizeWhitespace(
    String(input)
      .replace(/\bcontroleer dit even\.?/gi, '')
      .replace(/\bopgeslagen\.?/gi, '')
      .replace(/\bwat is de exacte datum van ['"].+?['"]\??/gi, '')
      .replace(/\bwelke datum bedoel je met ['"].+?['"](?: voor .+?)?\??/gi, '')
      .replace(/\bis de datum ['"].+?['"] zeker\??/gi, '')
      .replace(/\bvalt aanstaande vrijdag op de derde van april\??/gi, '')
      .replace(/\bwat is het type van deze invoer\??/gi, '')
      .replace(/\btaak\b\s*\n?/gi, '')
      .replace(/\bafspraak\b\s*\n?/gi, '')
      .replace(/\bnotitie\b\s*\n?/gi, '')
      .replace(/\bja,\s*3 april\b/gi, '3 april')
      .replace(/\b3 april denk ik\??/gi, '3 april')
      .replace(/\bnee,\s*niet zeker\b/gi, '')
      .replace(/\bvrijdag na 3 april\b/gi, '')
      .replace(/\b2024-04-03\b/gi, '')
  )
}

function stripQuestionLines(text = '') {
  const lines = String(text)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const filtered = lines.filter(line => {
    const lower = line.toLowerCase()

    if (/^welke datum\b/.test(lower)) return false
    if (/^wat is de exacte datum\b/.test(lower)) return false
    if (/^is de datum\b/.test(lower)) return false
    if (/^wat is het type\b/.test(lower)) return false
    if (/^(taak|afspraak|notitie)$/i.test(lower)) return false

    return true
  })

  return normalizeWhitespace(filtered.join('\n'))
}

function detectPreparseType(raw = '') {
  const text = safeString(raw).toLowerCase()

  if (/\bnotitie\b/.test(text)) return 'notitie'
  if (/\bafspraak\b/.test(text)) return 'afspraak'
  if (/\btaak\b/.test(text)) return 'taak'

  if (/\bdeadline\b/.test(text)) return 'taak'
  if (/\bcontroleer\b/.test(text)) return 'taak'
  if (/\bafwerking\b/.test(text)) return 'taak'
  if (/\bmoet\b/.test(text)) return 'taak'

  return 'taak'
}

function shouldForcePreparse(text = '') {
  const raw = safeString(text).toLowerCase()
  if (!raw) return false

  const signals = [
    /\bdeadline\b/,
    /\bcontroleer dit even\b/,
    /\bovermorgen\b/,
    /\bmorgen\b/,
    /\bvandaag\b/,
    /\b(a\.s\.|as|aanstaande|komende)\b/,
    /\bmaandag\b/,
    /\bdinsdag\b/,
    /\bwoensdag\b/,
    /\bdonderdag\b/,
    /\bvrijdag\b/,
    /\bzaterdag\b/,
    /\bzondag\b/,
    /\bdremel\b/,
    /\bfiller\b/,
    /\bafwerking\b/,
    /\btaak\b/,
    /\bafspraak\b/,
    /\bnotitie\b/
  ]

  return signals.some(rx => rx.test(raw))
}

function firstSentence(text = '') {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return ''
  const parts = normalized.split(/[.!?]\s+/)
  return safeString(parts[0], normalized)
}

function buildTaskSummaryFromLines(text = '') {
  const lines = String(text)
    .split('\n')
    .map(line => normalizeWhitespace(line))
    .filter(Boolean)

  const useful = []

  for (const line of lines) {
    const lower = line.toLowerCase()

    if (/^deadline\b/.test(lower)) continue
    if (/^(3 april|overmorgen|morgen|vandaag)$/i.test(lower)) continue
    if (/^(ja|nee)\b/i.test(lower)) continue

    useful.push(line)
  }

  if (!useful.length) return ''

  const summary = useful.join('. ')
    .replace(/\.\s+\./g, '. ')
    .replace(/\s+,/g, ',')
    .trim()

  return summary
}

function extractTitleAndSummaryFromPreparse(raw = '') {
  const cleaned = stripQuestionLines(stripMetaPhrases(fixCommonTypos(raw)))
  const deadlineMatch = cleaned.match(/\bdeadline\s+(.+?)(?:,|\n|$)/i)

  if (deadlineMatch) {
    const title = safeString(deadlineMatch[1], 'Nieuwe taak')
    const summaryText = cleaned.replace(deadlineMatch[0], '').trim()
    const summary = buildTaskSummaryFromLines(summaryText) || firstSentence(summaryText) || title
    return { title, summary }
  }

  const lines = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const firstMeaningful = lines.find(line => {
    const lower = line.toLowerCase()
    if (/^(ja|nee)\b/.test(lower)) return false
    if (/^(3 april|overmorgen|morgen|vandaag)$/i.test(lower)) return false
    return true
  })

  const title = safeString(firstMeaningful, 'Nieuwe invoer').slice(0, 80)
  const summary = buildTaskSummaryFromLines(cleaned) || firstSentence(cleaned) || title

  return { title, summary }
}

function preprocessUserInput(rawInput = '', baseDate = new Date()) {
  const fixed = fixCommonTypos(rawInput)
  const stripped = stripQuestionLines(stripMetaPhrases(fixed))

  const explicitDate = extractExplicitDateFromText(stripped, baseDate)
  const relativeDate = extractRelativeDateFromText(stripped, baseDate)

  let finalDate = explicitDate || relativeDate || ''

  if (explicitDate && /\b(vrijdag|maandag|dinsdag|woensdag|donderdag|zaterdag|zondag)\b/i.test(stripped)) {
    const explicitAsDate = new Date(`${explicitDate}T12:00:00Z`)
    const lower = stripped.toLowerCase()

    for (const [weekdayName, weekdayIndex] of Object.entries(DUTCH_WEEKDAYS)) {
      if (new RegExp(`\\b${weekdayName}\\b`, 'i').test(lower)) {
        if (explicitAsDate.getUTCDay() !== weekdayIndex) {
          finalDate = extractRelativeDateFromText(stripped, baseDate) || explicitDate
        }
      }
    }
  }

  const type = detectPreparseType(stripped)
  const { title, summary } = extractTitleAndSummaryFromPreparse(stripped)

  const cleanedSummary = normalizeWhitespace(
    summary
      .replace(/\b(?:morgen|overmorgen|vandaag)\b/gi, '')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
      .replace(/\b\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+\d{4})?\b/gi, '')
  )

  return {
    type,
    title: safeString(title, 'Nieuwe invoer'),
    summary: cleanedSummary || safeString(summary, 'Nieuwe invoer'),
    date: type === 'notitie' ? '' : finalDate,
    end_date: '',
    time: '',
    status: type === 'taak' ? 'nieuw' : '',
    priority: type === 'taak' ? 'middel' : '',
    source_text: stripped || fixed || rawInput
  }
}

function buildPreparseReview(body, pre) {
  const item = sanitizeItemForSave({
    temp_id: 'item_1',
    type: pre.type,
    title: pre.title,
    summary: pre.summary,
    project: '',
    date: pre.date,
    end_date: pre.end_date,
    time: pre.time,
    status: pre.status,
    priority: pre.priority,
    source_text: pre.source_text
  })

  const enrichedItem = enrichReviewItemsWithValidation([
    {
      temp_id: 'item_1',
      type: item.type,
      title: item.title,
      summary: item.summary,
      project: item.project,
      date: item.date,
      end_date: item.end_date,
      time: item.time,
      status: item.status,
      priority: item.priority,
      source_text: item.source_text
    }
  ])[0]

  const blocked = enrichedItem.invalid_fields.length > 0

  return buildResponse(body, {
    ok: true,
    mode: 'review',
    reply: blocked ? 'Controleer dit even. Er ontbreekt nog iets.' : 'Controleer dit even.',
    review: {
      summary: 'Ik heb dit alvast klaargezet.',
      items: [enrichedItem]
    },
    actions: [
      { type: 'confirm_review', label: 'Opslaan' },
      { type: 'edit_review_item', label: 'Aanpassen', temp_id: 'item_1' },
      { type: 'cancel_review', label: 'Annuleren' }
    ],
    meta: {
      needs_clarification: blocked,
      confidence: 0.92,
      can_save: !blocked,
      blocked_by: blocked ? enrichedItem.validation_issues?.[0]?.code || null : null
    }
  })
}

function sanitizeNotitieFields(item) {
  return {
    ...item,
    date: '',
    end_date: '',
    time: '',
    priority: '',
    status: '',
    note_type: 'general'
  }
}

function sanitizeItemCore(item, mode = 'save') {
  const sourceText = safeString(item.source_text)
  const title = safeString(item.title, 'Zonder titel')
  const summary = safeString(item.summary)
  const project = safeString(item.project)
  const status = safeString(item.status, 'nieuw')
  const priority = safeString(item.priority, 'middel')

  const combinedText = [title, summary, sourceText].filter(Boolean).join(' | ')
  const type = normalizeType(item.type)

  let date = ''
  let endDate = ''
  let time = ''

  if (mode === 'save') {
    const dateFromAI = normalizeDate(item.date)
    const dateFromText = normalizeDate(combinedText)

    if (dateFromText) {
      date = dateFromText
    } else if (dateFromAI) {
      const year = Number(dateFromAI.slice(0, 4))
      const currentYear = getAmsterdamDateParts(new Date()).year
      if (year >= currentYear) {
        date = dateFromAI
      }
    }

    endDate = normalizeDate(item.end_date) || ''
    time = normalizeTime(item.time) || extractTimeFromText(combinedText)
  } else {
    date = normalizeDate(item.date) || normalizeDate(combinedText)
    endDate = normalizeDate(item.end_date) || ''
    time = normalizeTime(item.time) || extractTimeFromText(combinedText)
  }

  let cleaned = {
    type,
    title,
    summary,
    project,
    status,
    date,
    end_date: endDate,
    time,
    priority,
    note_type: 'general',
    raw: sourceText,
    source_text: sourceText
  }

  if (type === 'notitie') {
    cleaned = sanitizeNotitieFields(cleaned)
  }

  return cleaned
}

function sanitizeItemForSave(item) {
  return sanitizeItemCore(item, 'save')
}

function sanitizeItemForUpdate(item) {
  return sanitizeItemCore(item, 'update')
}

function getItemValidationIssues(item) {
  const type = normalizeType(item.type)
  const title = safeString(item.title)
  const date = safeString(item.date)
  const time = safeString(item.time)

  const issues = []

  if (!title) {
    issues.push({
      field: 'title',
      code: 'missing_title',
      reason: 'Titel ontbreekt.'
    })
  }

  if (type === 'afspraak' && !date) {
    issues.push({
      field: 'date',
      code: 'missing_date',
      reason: 'Afspraak mist datum.'
    })
  }

  if (type === 'afspraak' && !time) {
    issues.push({
      field: 'time',
      code: 'missing_time',
      reason: 'Afspraak mist tijd.'
    })
  }

  return issues
}

function validateItemForSave(item) {
  const issues = getItemValidationIssues(item)

  if (!issues.length) {
    return { ok: true, blocked_by: null, reason: '', issues: [] }
  }

  return {
    ok: false,
    blocked_by: issues[0].code,
    reason: issues[0].reason,
    issues
  }
}

function buildMeta(body = {}, overrides = {}) {
  const baseConfidence = safeNumber(overrides.confidence, safeNumber(body.confidence, 0))
  return {
    session_id: safeString(overrides.session_id || body.session_id || body.sessionId),
    needs_clarification: Boolean(overrides.needs_clarification),
    confidence: clamp(baseConfidence, 0, 1),
    can_save: Boolean(overrides.can_save),
    blocked_by: overrides.blocked_by || null,
    error_code: overrides.error_code || null
  }
}

function buildResponse(body, {
  ok = true,
  mode = 'reply',
  reply = null,
  question = null,
  confirmation = null,
  review = null,
  actions = [],
  meta = {}
} = {}) {
  return {
    ok,
    success: ok,
    mode,
    reply,
    question,
    confirmation,
    review,
    actions,
    meta: buildMeta(body, meta)
  }
}

async function parseWithOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      mode: 'review',
      reply: 'Controleer dit even.',
      review: {
        summary: text,
        items: [
          {
            temp_id: 'item_1',
            type: 'notitie',
            title: text.slice(0, 80),
            summary: text,
            project: '',
            date: '',
            end_date: '',
            time: '',
            status: '',
            priority: '',
            source_text: text
          }
        ]
      },
      meta: {
        needs_clarification: false,
        confidence: 0.7,
        can_save: true
      }
    }
  }

  const prompt = `
Je bent Clara.

Zet de input om naar geldige JSON.

Doel:
- begrijp de input
- bepaal of iets direct review-klaar is of dat eerst een vraag nodig is

Regels:
- Types: taak, afspraak, notitie, idee, project, beslissing
- notitie is tijdloos:
  - geen date
  - geen end_date
  - geen time
  - geen priority
  - geen status
- afspraak moet alleen als afspraak terugkomen als datum en tijd voldoende duidelijk zijn
- bij onduidelijkheid geef mode="question"
- bij voldoende duidelijkheid geef mode="review"
- geef GEEN uitleg buiten JSON
- title = kort
- summary = 1 zin
- date alleen YYYY-MM-DD als zeker
- time alleen HH:MM als zeker
- elk review-item krijgt temp_id
- source_text = exact stukje uit input
- voeg meta toe met:
  - needs_clarification: true/false
  - confidence: 0..1
  - can_save: true/false

Toegestane formats:

QUESTION:
{
  "mode": "question",
  "reply": null,
  "question": {
    "text": "",
    "field": "",
    "options": [
      { "value": "", "label": "" }
    ],
    "allow_free_input": true
  },
  "confirmation": null,
  "review": null,
  "actions": [],
  "meta": {
    "needs_clarification": true,
    "confidence": 0.0,
    "can_save": false
  }
}

REVIEW:
{
  "mode": "review",
  "reply": "",
  "question": null,
  "confirmation": null,
  "review": {
    "summary": "",
    "items": [
      {
        "temp_id": "",
        "type": "",
        "title": "",
        "summary": "",
        "project": "",
        "date": "",
        "end_date": "",
        "time": "",
        "status": "",
        "priority": "",
        "source_text": ""
      }
    ]
  },
  "actions": [
    { "type": "confirm_review", "label": "Opslaan" },
    { "type": "edit_review_item", "label": "Aanpassen", "temp_id": "item_1" },
    { "type": "cancel_review", "label": "Annuleren" }
  ],
  "meta": {
    "needs_clarification": false,
    "confidence": 0.0,
    "can_save": true
  }
}

Input:
${text}
`.trim()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Geef alleen geldige JSON terug, zonder codeblok.' },
        { role: 'user', content: prompt }
      ]
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`openai_failed: ${errText}`)
  }

  const json = await response.json()
  const content = safeString(json?.choices?.[0]?.message?.content, '{}')
  return JSON.parse(content)
}

function enrichReviewItemsWithValidation(items) {
  return items.map(item => {
    const validation = validateItemForSave(item)
    return {
      ...item,
      invalid_fields: validation.issues.map(issue => issue.field),
      validation_issues: validation.issues
    }
  })
}

function normalizeReviewPayload(aiResult) {
  const mode = safeString(aiResult?.mode).toLowerCase()

  if (mode === 'question') {
    return {
      mode: 'question',
      reply: null,
      question: {
        text: safeString(aiResult?.question?.text, 'Kun je dit iets preciezer maken?'),
        field: safeString(aiResult?.question?.field, 'input'),
        options: Array.isArray(aiResult?.question?.options) ? aiResult.question.options : [],
        allow_free_input: aiResult?.question?.allow_free_input !== false
      },
      confirmation: null,
      review: null,
      actions: Array.isArray(aiResult?.actions) ? aiResult.actions : [],
      meta: {
        needs_clarification: true,
        confidence: clamp(safeNumber(aiResult?.meta?.confidence, 0.55), 0, 1),
        can_save: false
      }
    }
  }

  const rawItems = Array.isArray(aiResult?.review?.items) ? aiResult.review.items : []
  const cleanedItems = rawItems.map((item, index) => {
    const cleaned = sanitizeItemForSave(item)
    return {
      temp_id: safeString(item?.temp_id, `item_${index + 1}`),
      type: cleaned.type,
      title: cleaned.title,
      summary: cleaned.summary,
      project: cleaned.project,
      date: cleaned.date,
      end_date: cleaned.end_date,
      time: cleaned.time,
      status: cleaned.status,
      priority: cleaned.priority,
      source_text: cleaned.source_text
    }
  })

  const enrichedItems = enrichReviewItemsWithValidation(cleanedItems)
  const blocked = enrichedItems.find(item => item.invalid_fields.length > 0)

  const review = {
    summary: safeString(aiResult?.review?.summary),
    items: enrichedItems
  }

  const actions = enrichedItems.length
    ? [
        { type: 'confirm_review', label: 'Opslaan' },
        ...enrichedItems.map(item => ({
          type: 'edit_review_item',
          label: 'Aanpassen',
          temp_id: item.temp_id
        })),
        { type: 'cancel_review', label: 'Annuleren' }
      ]
    : []

  if (blocked) {
    return {
      mode: 'review',
      reply: 'Controleer dit even. Er ontbreekt nog iets.',
      question: null,
      confirmation: null,
      review,
      actions,
      meta: {
        needs_clarification: true,
        confidence: clamp(safeNumber(aiResult?.meta?.confidence, 0.6), 0, 1),
        can_save: false,
        blocked_by: blocked.validation_issues?.[0]?.code || null
      }
    }
  }

  return {
    mode: 'review',
    reply: safeString(aiResult?.reply, 'Controleer dit even.'),
    question: null,
    confirmation: null,
    review,
    actions,
    meta: {
      needs_clarification: false,
      confidence: clamp(safeNumber(aiResult?.meta?.confidence, 0.9), 0, 1),
      can_save: review.items.length > 0
    }
  }
}

async function deleteItem(body) {
  const itemId = safeString(body.id || body.item_id)

  if (itemId) {
    const { data, error } = await supabase
      .from('clara_items')
      .delete()
      .eq('id', itemId)
      .select('id, title, type')

    if (error) {
      throw new Error(`delete_failed: ${error.message}`)
    }

    return {
      deleted: data?.length || 0,
      item: data?.[0] || null
    }
  }

  const type = normalizeType(body.type)
  const title = safeString(body.title)
  const date = safeString(body.date)
  const time = safeString(body.time)
  const project = safeString(body.project)

  if (!title) {
    throw new Error('delete_failed: missing id and title')
  }

  let query = supabase
    .from('clara_items')
    .delete()
    .eq('type', type)
    .eq('title', title)

  if (date) query = query.eq('date', date)
  if (time) query = query.eq('time', time)
  if (project) query = query.eq('project', project)

  const { data, error } = await query.select('id, title, type')

  if (error) {
    throw new Error(`delete_failed: ${error.message}`)
  }

  return {
    deleted: data?.length || 0,
    item: data?.[0] || null
  }
}

async function updateItem(body) {
  const itemId = safeString(body.id || body.item_id)
  if (!itemId) {
    throw new Error('update_failed: missing id')
  }

  const cleaned = sanitizeItemForUpdate(body)
  const validation = validateItemForSave(cleaned)

  if (!validation.ok && cleaned.type === 'afspraak') {
    throw new Error(`update_failed: ${validation.blocked_by}`)
  }

  const now = new Date().toISOString()

  const updatePayload = {
    type: cleaned.type,
    title: cleaned.title,
    summary: cleaned.summary,
    project: cleaned.project,
    status: cleaned.status,
    date: cleaned.date,
    end_date: cleaned.end_date,
    time: cleaned.time,
    priority: cleaned.priority,
    note_type: cleaned.note_type,
    raw: cleaned.raw,
    source_text: cleaned.source_text,
    updated_at: now
  }

  const { data, error } = await supabase
    .from('clara_items')
    .update(updatePayload)
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    throw new Error(`update_failed: ${error.message}`)
  }

  return data
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'method_not_allowed'
      })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const message = safeString(body.message)
    const action = safeString(body.action)

    if (!message && !action) {
      return res.status(400).json({
        error: 'missing_input'
      })
    }

    if (!action) {
      if (shouldForcePreparse(message)) {
        const pre = preprocessUserInput(message, new Date())
        return res.status(200).json(buildPreparseReview(body, pre))
      }

      const aiResult = await parseWithOpenAI(message)
      const normalized = normalizeReviewPayload(aiResult)

      return res.status(200).json(
        buildResponse(body, {
          ok: true,
          mode: normalized.mode,
          reply: normalized.reply,
          question: normalized.question,
          confirmation: normalized.confirmation,
          review: normalized.review,
          actions: normalized.actions,
          meta: normalized.meta
        })
      )
    }

    if (action === 'confirm_review') {
      const items = Array.isArray(body.items) ? body.items : []

      if (!items.length) {
        return res.status(400).json({
          error: 'no_items_to_save'
        })
      }

      const cleanedItems = items.map((item, index) => {
        const cleaned = sanitizeItemForSave(item)
        return {
          temp_id: safeString(item?.temp_id, `item_${index + 1}`),
          type: cleaned.type,
          title: cleaned.title,
          summary: cleaned.summary,
          project: cleaned.project,
          date: cleaned.date,
          end_date: cleaned.end_date,
          time: cleaned.time,
          status: cleaned.status,
          priority: cleaned.priority,
          source_text: cleaned.source_text
        }
      })

      const enrichedItems = enrichReviewItemsWithValidation(cleanedItems)
      const blocked = enrichedItems.find(item => item.invalid_fields.length > 0)

      if (blocked) {
        return res.status(200).json(
          buildResponse(body, {
            ok: true,
            mode: 'review',
            reply: 'Nog niet opgeslagen. Vul eerst de ontbrekende velden aan.',
            question: null,
            confirmation: null,
            review: {
              summary: safeString(body.review_summary || 'Controleer en vul aan.'),
              items: enrichedItems
            },
            actions: [
              { type: 'confirm_review', label: 'Opslaan' },
              ...enrichedItems.map(item => ({
                type: 'edit_review_item',
                label: 'Aanpassen',
                temp_id: item.temp_id
              })),
              { type: 'cancel_review', label: 'Annuleren' }
            ],
            meta: {
              needs_clarification: true,
              confidence: 0.6,
              can_save: false,
              blocked_by: blocked.validation_issues?.[0]?.code || null
            }
          })
        )
      }

      const now = new Date().toISOString()

      const inserts = cleanedItems.map(item => ({
        type: item.type,
        title: item.title,
        summary: item.summary,
        project: item.project,
        status: item.status,
        date: item.date,
        end_date: item.end_date,
        time: item.time,
        priority: item.priority,
        note_type: 'general',
        raw: item.source_text,
        source_text: item.source_text,
        created_at: now,
        updated_at: now
      }))

      const { data, error } = await supabase
        .from('clara_items')
        .insert(inserts)
        .select()

      if (error) {
        return res.status(500).json(
          buildResponse(body, {
            ok: false,
            mode: 'reply',
            reply: 'Er ging iets mis bij het opslaan.',
            meta: {
              needs_clarification: false,
              confidence: 0,
              can_save: false,
              error_code: error.code || 'SUPABASE_ERROR'
            }
          })
        )
      }

      return res.status(200).json(
        buildResponse(body, {
          ok: true,
          mode: 'confirmation',
          reply: null,
          confirmation: {
            text: 'Opgeslagen.',
            saved: (data || []).map(item => ({
              id: item.id,
              type: item.type,
              title: item.title
            }))
          },
          review: null,
          actions: [],
          meta: {
            needs_clarification: false,
            confidence: 1,
            can_save: false
          }
        })
      )
    }

    if (action === 'update_item') {
      const updated = await updateItem(body)

      return res.status(200).json(
        buildResponse(body, {
          ok: true,
          mode: 'confirmation',
          reply: 'Item bijgewerkt.',
          confirmation: {
            text: 'Item bijgewerkt.',
            saved: [
              {
                id: updated.id,
                type: updated.type,
                title: updated.title
              }
            ]
          },
          review: null,
          actions: [],
          meta: {
            needs_clarification: false,
            confidence: 1,
            can_save: false
          }
        })
      )
    }

    if (action === 'delete_item') {
      const result = await deleteItem(body)

      if (!result.deleted) {
        return res.status(404).json({
          error: 'not_found',
          details: 'Geen match gevonden om te verwijderen.'
        })
      }

      return res.status(200).json(
        buildResponse(body, {
          ok: true,
          mode: 'confirmation',
          reply: `Verwijderd. ${result.deleted} item(s).`,
          confirmation: {
            text: `Verwijderd. ${result.deleted} item(s).`,
            saved: []
          },
          review: null,
          actions: [],
          meta: {
            needs_clarification: false,
            confidence: 1,
            can_save: false
          }
        })
      )
    }

    return res.status(400).json({
      error: 'unknown_action'
    })
  } catch (e) {
    return res.status(500).json(
      buildResponse({}, {
        ok: false,
        mode: 'reply',
        reply: 'Er ging iets mis bij het verwerken van je bericht.',
        meta: {
          needs_clarification: false,
          confidence: 0,
          can_save: false,
          error_code: 'SERVER_ERROR'
        }
      })
    )
  }
}
