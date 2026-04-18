const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

const AMSTERDAM_TZ = 'Europe/Amsterdam'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const TABLE_NAME = 'clara_items'

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

const EMPTY_ITEM = Object.freeze({
  type: '',
  title: '',
  summary: '',
  project: '',
  status: '',
  priority: '',
  date: '',
  end_date: '',
  time: '',
  source_text: ''
})

const ALLOWED_TYPES = new Set(['taak', 'afspraak', 'notitie', 'idee', 'project', 'beslissing'])
const TASK_STATUSES = new Set(['nieuw', 'open', 'bezig', 'wacht', 'klaar'])
const TASK_PRIORITIES = new Set(['laag', 'middel', 'hoog'])

const STOP_WORDS = new Set([
  'de', 'het', 'een', 'en', 'of', 'van', 'voor', 'met', 'naar', 'om', 'te', 'op', 'in',
  'aan', 'bij', 'tot', 'uit', 'als', 'dan', 'dat', 'dit', 'die', 'is', 'zijn', 'was',
  'wordt', 'werd', 'ik', 'je', 'jij', 'we', 'wij', 'hij', 'zij', 'ze', 'u', 'mijn',
  'jouw', 'ons', 'onze', 'hun', 'hem', 'haar', 'er', 'hier', 'daar', 'nog', 'ook',
  'wel', 'niet', 'geen', 'al', 'maar', 'dus', 'dan', 'nu', 'later', 'even'
])

const CLARA_MASTER_PROMPT = `
Je bent Clara, een compacte en scherpe assistent voor werkstructuur.

Doel:
Zet rommelige menselijke invoer om naar een strakke JSON-response voor review.
Maar:
- als de gebruiker gewoon los praat, groet, grap maakt, test, of iets zegt dat niet echt een taak, afspraak, notitie, idee, project of beslissing is:
  - geef dan GEEN review
  - geef dan GEEN question
  - geef dan een korte reply terug
  - toon een klein beetje persoonlijkheid
  - een droog, licht grapje mag
  - houd het kort, maximaal 2 zinnen
  - blijf wel Clara: helder, direct, niet melig

Belangrijke regels:
- Begrijp de echte bedoeling van de gebruiker.
- Begrijp relatieve datums altijd vanuit de expliciet meegegeven datumcontext.
- Gebruik "vandaag", "morgen", "overmorgen" en weekdagen alleen relatief aan die datumcontext.
- Negeer ruis, herhalingen, twijfelzinnen en meta-praat.
- Maak nooit dubbele of halve zinnen.
- Verbeter duidelijke typfouten stilzwijgend.
- Gebruik alleen deze types:
  - taak
  - afspraak
  - notitie
  - idee
  - project
  - beslissing
- Gebruik altijd exact deze keys per item:
  - type
  - title
  - summary
  - project
  - status
  - priority
  - date
  - end_date
  - time
  - source_text
- Geef ontbrekende waarden als lege string.
- Verzin geen datum of tijd als die niet duidelijk is.
- Zet expliciete datums bij voorkeur direct om naar YYYY-MM-DD.
- Zet expliciete tijden bij voorkeur direct om naar HH:MM.
- Een afspraak mag met alleen datum.
- Een afspraak zonder tijd betekent een hele-dag afspraak.
- Een afspraak mag alleen als datum voldoende duidelijk is.
- Als iets duidelijk een afspraak is maar datum ontbreekt, geef QUESTION terug.
- Een taak mag wel met datum en zonder tijd.
- Een notitie is altijd tijdloos:
  - status = ""
  - priority = ""
  - date = ""
  - end_date = ""
  - time = ""
- Title:
  - kort
  - concreet
  - geen datum vooraan
  - geen losse woorden zoals "a", "ja", "morgen"
- Summary:
  - maximaal 1 korte zin
  - compact en betekenisvol
  - geen meta
  - geen duplicatie van de titel
  - herhaal geen naam, onderwerp of formulering die al duidelijk in de titel zit
  - voeg alleen context, bedoeling of planning toe die nog niet in de titel zit
  - als er weinig extra context is: geef een ultrakorte samenvatting van planning of bedoeling, niet een herhaling van de titel
  - slechte voorbeelden:
    - Titel: "Afspraak met Joep" → Summary: "Afspraak met Joep op 2 april"
    - Titel: "Werkplaats opruimen" → Summary: "Werkplaats opruimen morgen"
  - betere voorbeelden:
    - Titel: "Afspraak met Joep" → Summary: "2 april samenkomen"
    - Titel: "Werkplaats opruimen" → Summary: "morgen oppakken"
- Source_text:
  - alleen het relevante opgeschoonde bronstuk
- Maak liever 1 goed item dan meerdere slordige duplicaten.
- Als de input alleen bevestiging/ruis is zonder echte inhoud, geef REPLY terug in plaats van QUESTION.
- Gebruik QUESTION alleen als er wel duidelijk werkintentie is, maar cruciale info ontbreekt.

Antwoord altijd als geldige JSON in exact een van deze vormen.

REPLY:
{
  "mode": "reply",
  "reply": "",
  "question": null,
  "confirmation": null,
  "review": null,
  "actions": [],
  "meta": {
    "needs_clarification": false,
    "confidence": 0.0,
    "can_save": false
  }
}

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
  "reply": "Controleer dit even.",
  "question": null,
  "confirmation": null,
  "review": {
    "summary": "Ik heb dit alvast klaargezet.",
    "items": [
      {
        "temp_id": "item_1",
        "type": "taak",
        "title": "",
        "summary": "",
        "project": "",
        "status": "",
        "priority": "",
        "date": "",
        "end_date": "",
        "time": "",
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

Geef alleen JSON terug, zonder uitleg of codeblok.
`.trim()

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
    .replace(/[ ]*\n[ ]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeProjectMatchKey(raw) {
  return normalizeWhitespace(
    String(raw || '')
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
  )
}

function normalizeType(input) {
  const raw = safeString(input).toLowerCase()

  if (['task', 'taak', 'todo', 'to-do'].includes(raw)) return 'taak'
  if (['agenda', 'afspraak', 'event', 'appointment'].includes(raw)) return 'afspraak'
  if (['note', 'notitie', 'notes'].includes(raw)) return 'notitie'
  if (['idea', 'idee', 'ideen'].includes(raw)) return 'idee'
  if (['project', 'projects'].includes(raw)) return 'project'
  if (['beslissing', 'decision'].includes(raw)) return 'beslissing'

  return ALLOWED_TYPES.has(raw) ? raw : 'notitie'
}

function normalizeStatus(type, input) {
  if (type !== 'taak') return ''
  const raw = safeString(input).toLowerCase()
  if (!raw) return 'nieuw'
  return TASK_STATUSES.has(raw) ? raw : 'nieuw'
}

function normalizePriority(type, input) {
  if (type !== 'taak') return ''
  const raw = safeString(input).toLowerCase()
  if (!raw) return 'middel'
  return TASK_PRIORITIES.has(raw) ? raw : 'middel'
}

function getAmsterdamDateParts(baseDate = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = fmt.formatToParts(baseDate)
  const year = Number(parts.find(p => p.type === 'year')?.value)
  const month = Number(parts.find(p => p.type === 'month')?.value)
  const day = Number(parts.find(p => p.type === 'day')?.value)

  return { year, month, day }
}

function getAmsterdamNowContext(baseDate = new Date()) {
  const dateFmt = new Intl.DateTimeFormat('nl-NL', {
    timeZone: AMSTERDAM_TZ,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const timeFmt = new Intl.DateTimeFormat('nl-NL', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const { year, month, day } = getAmsterdamDateParts(baseDate)
  const weekday = dateFmt.format(baseDate).split(' ')[0].toLowerCase()
  const todayYMD = `${year}-${pad2(month)}-${pad2(day)}`
  const nowHHMM = timeFmt.format(baseDate)

  return {
    timezone: AMSTERDAM_TZ,
    today_ymd: todayYMD,
    weekday_nl: weekday,
    now_hhmm: nowHHMM
  }
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

  if (diff < 0 || (!includeToday && diff === 0)) diff += 7

  return formatUTCDateYMD(addDaysUTC(today, diff))
}

function normalizeExplicitDateString(raw) {
  const value = safeString(raw).toLowerCase()
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

  match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  match = value.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = DUTCH_MONTHS[match[2]]
    const year = Number(match[3])
    if (month && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  match = value.match(/^(\d{1,2})\s+([a-z]+)$/)
  if (match) {
    const day = Number(match[1])
    const month = DUTCH_MONTHS[match[2]]
    const currentYear = getAmsterdamDateParts(new Date()).year
    if (month && day >= 1 && day <= 31) {
      return `${currentYear}-${pad2(month)}-${pad2(day)}`
    }
  }

  return ''
}

function extractRelativeDate(raw) {
  const value = ` ${safeString(raw).toLowerCase()} `
  if (!value.trim()) return ''

  const today = getAmsterdamTodayUTC(new Date())

  if (/\bovermorgen\b/.test(value)) return formatUTCDateYMD(addDaysUTC(today, 2))
  if (/\bmorgen\b/.test(value)) return formatUTCDateYMD(addDaysUTC(today, 1))
  if (/\bvandaag\b/.test(value)) return formatUTCDateYMD(today)

  for (const [weekdayName, weekdayIndex] of Object.entries(DUTCH_WEEKDAYS)) {
    const regex = new RegExp(`\\b${weekdayName}(?:\\s*(?:a\\.s\\.|as|aanstaande))?\\b`, 'i')
    if (regex.test(value)) {
      return getNextWeekdayYMD(weekdayIndex, false, new Date())
    }
  }

  return ''
}

function normalizeDate(raw) {
  const value = safeString(raw)
  if (!value) return ''
  return normalizeExplicitDateString(value) || extractRelativeDate(value) || ''
}

function normalizeTime(raw) {
  const value = safeString(raw).toLowerCase()
  if (!value) return ''

  let match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  match = value.match(/^(\d{1,2})[.](\d{2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  match = value.match(/^(\d{1,2})$/)
  if (match) {
    const hh = Number(match[1])
    if (hh >= 0 && hh <= 23) return `${pad2(hh)}:00`
  }

  return ''
}

function extractDateFromText(text) {
  const value = normalizeWhitespace(text).toLowerCase()
  if (!value) return ''

  const explicit =
    value.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ||
    value.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/)?.[0] ||
    value.match(/\b\d{1,2}\s+[a-z]+\s+\d{4}\b/)?.[0] ||
    value.match(/\b\d{1,2}\s+[a-z]+\b/)?.[0]

  if (explicit) return normalizeExplicitDateString(explicit)

  return extractRelativeDate(value)
}

function extractTimeFromText(text) {
  const value = normalizeWhitespace(text).toLowerCase()
  if (!value) return ''

  const match =
    value.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ||
    value.match(/\b(\d{1,2}\.\d{2})\b/)?.[1] ||
    value.match(/\bom\s+(\d{1,2})\b/)?.[1]

  return normalizeTime(match || '')
}

function hasExplicitTimeInText(text) {
  const value = normalizeWhitespace(text).toLowerCase()
  if (!value) return false

  return (
    /\b\d{1,2}:\d{2}\b/.test(value) ||
    /\b\d{1,2}\.\d{2}\b/.test(value) ||
    /\bom\s+\d{1,2}\b/.test(value)
  )
}

function sanitizeNotitieFields(item) {
  return {
    ...item,
    status: '',
    priority: '',
    date: '',
    end_date: '',
    time: ''
  }
}

function makeComparableText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeComparableText(value) {
  const text = makeComparableText(value)
  return text ? text.split(' ').filter(Boolean) : []
}

function tokenizeForSimilarity(value) {
  return tokenizeComparableText(value).filter(token => !STOP_WORDS.has(token))
}

function overlapScore(a, b) {
  const aTokens = new Set(tokenizeForSimilarity(a))
  const bTokens = new Set(tokenizeForSimilarity(b))
  if (!aTokens.size || !bTokens.size) return 0

  let overlap = 0
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1
  }

  return overlap / Math.max(aTokens.size, bTokens.size)
}

function titleCore(value) {
  return makeComparableText(value)
    .replace(/\b(vandaag|morgen|overmorgen)\b/g, ' ')
    .replace(/\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\b/g, ' ')
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titlesLookSimilar(a, b) {
  const normA = titleCore(a)
  const normB = titleCore(b)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.includes(normB) || normB.includes(normA)) return true
  return overlapScore(normA, normB) >= 0.72
}

function summariesLookSimilar(a, b) {
  const normA = makeComparableText(a)
  const normB = makeComparableText(b)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.includes(normB) || normB.includes(normA)) return true
  return overlapScore(normA, normB) >= 0.8
}

function projectLooksSimilar(a, b) {
  const normA = makeComparableText(a)
  const normB = makeComparableText(b)
  if (!normA && !normB) return true
  if (!normA || !normB) return false
  return normA === normB
}

function buildDedupeKey(item) {
  return [
    normalizeType(item?.type),
    titleCore(item?.title),
    safeString(item?.date),
    safeString(item?.time),
    makeComparableText(item?.project)
  ].join('|')
}

function formatHumanDate(dateStr) {
  const normalized = normalizeDate(dateStr)
  if (!normalized) return ''
  const [year, month, day] = normalized.split('-').map(Number)
  const monthName = Object.keys(DUTCH_MONTHS).find(key => DUTCH_MONTHS[key] === month) || ''
  if (!day || !monthName) return normalized
  return `${day} ${monthName}`
}

function stripLeadingLabelPhrases(text) {
  return normalizeWhitespace(text)
    .replace(/^(afspraak|taak|notitie|idee|project|beslissing)\s+(met|om|voor|over)\s+/i, '')
    .replace(/^(afspraak|taak|notitie|idee|project|beslissing)\s+/i, '')
    .trim()
}

function removeTitleFromSummary(summary, title) {
  let result = normalizeWhitespace(summary)
  const cleanTitle = normalizeWhitespace(title)
  if (!result) return ''

  if (cleanTitle) {
    const escapedTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escapedTitle, 'ig'), ' ')
  }

  const titleTokens = tokenizeForSimilarity(title)
  if (titleTokens.length) {
    const tokenRegex = new RegExp(`\\b(?:${titleTokens.map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'ig')
    result = result.replace(tokenRegex, ' ')
  }

  result = result
    .replace(/\b(op|voor|om|met|naar)\s*$/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

  return stripLeadingLabelPhrases(result)
}

function cleanupSummarySentence(text) {
  return normalizeWhitespace(text)
    .replace(/^[,.;:!?\-–—\s]+/, '')
    .replace(/[,.;:!?\-–—\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .split(/(?<=[.!?])\s+/)[0]
    .trim()
}

function buildFallbackSummary(type, date, time, project) {
  const humanDate = formatHumanDate(date)
  const projectPart = safeString(project)

  if (type === 'afspraak') {
    if (humanDate && time) return `${humanDate} ${time}`
    if (humanDate) return `${humanDate} hele dag`
    if (projectPart) return projectPart
    return ''
  }

  if (type === 'taak') {
    if (humanDate) return `${humanDate} oppakken`
    if (projectPart) return `voor ${projectPart}`
    return ''
  }

  if (type === 'idee') {
    if (projectPart) return `voor ${projectPart}`
    return ''
  }

  if (type === 'project') {
    if (projectPart) return `onder ${projectPart}`
    return ''
  }

  if (type === 'beslissing') {
    if (projectPart) return `voor ${projectPart}`
    return ''
  }

  return ''
}

function buildSmartSummary({ type, title, summary, sourceText, date, time, project }) {
  const cleanTitle = normalizeWhitespace(title)
  const rawSummary = normalizeWhitespace(summary)
  const rawSource = normalizeWhitespace(sourceText)

  let candidate = rawSummary || rawSource || ''
  candidate = removeTitleFromSummary(candidate, cleanTitle)
  candidate = cleanupSummarySentence(candidate)

  const titleComparable = makeComparableText(cleanTitle)
  const candidateComparable = makeComparableText(candidate)

  const looksDuplicate =
    !candidate ||
    !candidateComparable ||
    candidateComparable === titleComparable ||
    candidateComparable.includes(titleComparable) ||
    titleComparable.includes(candidateComparable) ||
    titlesLookSimilar(candidate, cleanTitle) ||
    summariesLookSimilar(candidate, cleanTitle)

  if (!looksDuplicate) {
    return candidate.slice(0, 160)
  }

  return buildFallbackSummary(type, date, time, project).slice(0, 160)
}

function sanitizeItemCore(item, mode = 'save') {
  const rawType = normalizeType(item?.type)
  const type = rawType || 'notitie'

  const title =
    normalizeWhitespace(item?.title) ||
    normalizeWhitespace(item?.summary).slice(0, 80) ||
    normalizeWhitespace(item?.source_text).slice(0, 80)

  const project = normalizeWhitespace(item?.project)
  const sourceText =
    normalizeWhitespace(item?.source_text) ||
    normalizeWhitespace(item?.raw) ||
    normalizeWhitespace(item?.summary) ||
    title

  let date = normalizeDate(item?.date)
  let endDate = normalizeDate(item?.end_date)
  let time = normalizeTime(item?.time)
  let status = normalizeStatus(type, item?.status)
  let priority = normalizePriority(type, item?.priority)

  if (mode === 'save') {
    if (!date) date = extractDateFromText(sourceText)

    if (type === 'afspraak') {
      const sourceHasTime = hasExplicitTimeInText(sourceText)

      if (sourceHasTime) {
        if (!time) time = extractTimeFromText(sourceText)
      } else {
        time = ''
      }
    }
  }

  const summary = buildSmartSummary({
    type,
    title,
    summary: item?.summary,
    sourceText,
    date,
    time,
    project
  })

  let cleaned = {
    ...EMPTY_ITEM,
    type,
    title,
    summary,
    project,
    status,
    priority,
    date,
    end_date: endDate,
    time,
    source_text: sourceText
  }

  if (type === 'notitie') {
    cleaned = sanitizeNotitieFields(cleaned)
  }

  if (type !== 'taak') {
    cleaned.status = ''
    cleaned.priority = ''
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

function stripNoiseForAI(text) {
  return normalizeWhitespace(text)
    .replace(/^\s*(ja|nee|ok|oke|top|mooi|thanks|dank)\s*$/gim, '')
    .trim()
}

function buildAIInput(text) {
  const ctx = getAmsterdamNowContext(new Date())
  const cleanedInput = stripNoiseForAI(text)

  return {
    cleaned_input: cleanedInput || normalizeWhitespace(text),
    context: {
      timezone: ctx.timezone,
      today_ymd: ctx.today_ymd,
      weekday_nl: ctx.weekday_nl,
      now_hhmm: ctx.now_hhmm
    }
  }
}

function looksLikeStructuredWorkInput(text) {
  const value = normalizeWhitespace(text).toLowerCase()
  if (!value) return false

  const workTypeWords = /\b(taak|afspraak|notitie|idee|project|beslissing|todo|agenda)\b/
  const dateWords = /\b(vandaag|morgen|overmorgen|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|\d{1,2}[:.]\d{2}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/
  const taskVerbs = /\b(bellen|terugbellen|mailen|sturen|plannen|afspreken|maken|doen|uitzoeken|regelen|opruimen|kopen|bestellen|checken|schrijven|bespreken|reviewen|fixen|testen|updaten|inplannen)\b/
  const projectish = /\b(voor|over|met)\s+[a-z0-9]/i

  if (workTypeWords.test(value)) return true
  if (dateWords.test(value)) return true
  if (taskVerbs.test(value)) return true
  if (projectish.test(value) && value.split(/\s+/).length >= 4) return true

  return false
}

function buildCasualReply(text) {
  const value = normalizeWhitespace(text).toLowerCase()

  if (!value) return 'Ik hoor nog niets. Zelfs mijn denkbeeldige notitieblok blijft leeg.'

  if (/\b(hoi|hey|heya|hallo|yo|goedemorgen|goedemiddag|goedenavond)\b/.test(value)) {
    return 'Hi. Ik ben wakker. Mijn innerlijke paperclip ook.'
  }

  if (/\b(test|testen|ping)\b/.test(value)) {
    return 'Test ontvangen. Geen rook, geen paniek, alles leeft nog.'
  }

  if (/\b(haha|lol|grap|grappig)\b/.test(value)) {
    return 'Mooi. Ik noteer voorlopig alleen serieuze chaos.'
  }

  return 'Dat klinkt gezellig, maar nog niet echt als iets om op te slaan. Geef me een taak, afspraak, notitie of project en ik trek het strak.'
}

async function parseWithOpenAI(text) {
  const aiInput = buildAIInput(text)
  const cleanedInput = aiInput.cleaned_input

  if (!process.env.OPENAI_API_KEY) {
    if (!looksLikeStructuredWorkInput(cleanedInput)) {
      return {
        mode: 'reply',
        reply: buildCasualReply(cleanedInput),
        question: null,
        confirmation: null,
        review: null,
        actions: [],
        meta: {
          needs_clarification: false,
          confidence: 0.7,
          can_save: false
        }
      }
    }

    return {
      mode: 'review',
      reply: 'Controleer dit even.',
      review: {
        summary: 'Ik heb dit alvast klaargezet.',
        items: [
          {
            temp_id: 'item_1',
            ...sanitizeItemForSave({
              type: 'notitie',
              title: cleanedInput.slice(0, 80),
              summary: cleanedInput,
              source_text: cleanedInput
            })
          }
        ]
      },
      actions: [
        { type: 'confirm_review', label: 'Opslaan' },
        { type: 'edit_review_item', label: 'Aanpassen', temp_id: 'item_1' },
        { type: 'cancel_review', label: 'Annuleren' }
      ],
      meta: {
        needs_clarification: false,
        confidence: 0.7,
        can_save: true
      }
    }
  }

  const prompt = `${CLARA_MASTER_PROMPT}

Datumcontext Amsterdam:
- timezone: ${aiInput.context.timezone}
- vandaag: ${aiInput.context.today_ymd}
- weekdag: ${aiInput.context.weekday_nl}
- huidige tijd: ${aiInput.context.now_hhmm}

Input:
${cleanedInput}
`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Geef alleen geldige JSON terug, zonder codeblok of toelichting.'
        },
        {
          role: 'user',
          content: prompt
        }
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

function normalizeQuestionPayload(aiResult) {
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

function normalizeReplyPayload(aiResult) {
  return {
    mode: 'reply',
    reply: safeString(aiResult?.reply, 'Vertel maar.'),
    question: null,
    confirmation: null,
    review: null,
    actions: [],
    meta: {
      needs_clarification: false,
      confidence: clamp(safeNumber(aiResult?.meta?.confidence, 0.8), 0, 1),
      can_save: false
    }
  }
}

async function findReviewDuplicateCandidates(items) {
  const seenIds = new Set()
  const candidates = []

  for (const item of items) {
    let query = supabase
      .from(TABLE_NAME)
      .select('id, type, title, summary, project, date, time')
      .eq('type', item.type)
      .limit(80)

    if (item.date) {
      query = query.eq('date', item.date)
    }

    const { data, error } = await query
    if (error) throw new Error(`duplicate_candidates_failed: ${error.message}`)

    for (const row of data || []) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id)
        candidates.push(row)
      }
    }
  }

  return candidates
}

function detectDuplicateMatch(item, candidates) {
  const itemType = normalizeType(item.type)

  for (const candidate of candidates) {
    if (normalizeType(candidate.type) !== itemType) continue

    const sameDate = safeString(candidate.date) === safeString(item.date)
    const sameTime = safeString(candidate.time) === safeString(item.time)
    const sameProject = projectLooksSimilar(candidate.project, item.project)

    const titleSimilar = titlesLookSimilar(candidate.title, item.title)
    const summarySimilar = summariesLookSimilar(candidate.summary, item.summary)

    if (titleSimilar && sameDate && sameTime && sameProject) {
      return {
        duplicate_warning: true,
        duplicate_match_id: candidate.id,
        duplicate_match_title: candidate.title,
        duplicate_match_reason: 'zelfde kern, datum, tijd en project'
      }
    }

    if (itemType === 'afspraak' && titleSimilar && sameDate && sameTime) {
      return {
        duplicate_warning: true,
        duplicate_match_id: candidate.id,
        duplicate_match_title: candidate.title,
        duplicate_match_reason: 'vergelijkbare afspraak op hetzelfde moment'
      }
    }

    if (itemType === 'taak' && titleSimilar && sameDate && sameProject) {
      return {
        duplicate_warning: true,
        duplicate_match_id: candidate.id,
        duplicate_match_title: candidate.title,
        duplicate_match_reason: 'vergelijkbare taak op dezelfde datum'
      }
    }

    if (itemType === 'notitie' && !item.date && !candidate.date && titleSimilar && summarySimilar) {
      return {
        duplicate_warning: true,
        duplicate_match_id: candidate.id,
        duplicate_match_title: candidate.title,
        duplicate_match_reason: 'vergelijkbare notitie zonder datum'
      }
    }

    if (titleSimilar && sameDate && sameProject) {
      return {
        duplicate_warning: true,
        duplicate_match_id: candidate.id,
        duplicate_match_title: candidate.title,
        duplicate_match_reason: 'vergelijkbare titel, datum en project'
      }
    }

    if (summarySimilar && sameDate && sameTime && sameProject) {
      return {
        duplicate_warning: true,
        duplicate_match_id: candidate.id,
        duplicate_match_title: candidate.title,
        duplicate_match_reason: 'vergelijkbare inhoud op hetzelfde moment'
      }
    }
  }

  return {
    duplicate_warning: false,
    duplicate_match_id: '',
    duplicate_match_title: '',
    duplicate_match_reason: ''
  }
}

async function addDuplicateWarningsToReviewItems(items) {
  const candidates = await findReviewDuplicateCandidates(items)

  return items.map(item => ({
    ...item,
    ...detectDuplicateMatch(item, candidates)
  }))
}

async function normalizeReviewPayload(aiResult) {
  const mode = safeString(aiResult?.mode).toLowerCase()

  if (mode === 'question') {
    return normalizeQuestionPayload(aiResult)
  }

  if (mode === 'reply') {
    return normalizeReplyPayload(aiResult)
  }

  const rawItems = Array.isArray(aiResult?.review?.items) ? aiResult.review.items : []
  const cleanedItems = rawItems.map((item, index) => {
    const cleaned = sanitizeItemForSave(item)
    return {
      temp_id: safeString(item?.temp_id, `item_${index + 1}`),
      ...cleaned
    }
  })

  const uniqueMap = new Map()
  for (const item of cleanedItems) {
    const key = buildDedupeKey(item)
    if (!uniqueMap.has(key)) uniqueMap.set(key, item)
  }

  const uniqueItems = Array.from(uniqueMap.values())
  const itemsWithProjectPrep = uniqueItems.map(item => {
    const projectNorm = normalizeWhitespace(item.project)
    return {
      ...item,
      project_label: projectNorm || null,
      project_resolution: { resolved_id: null, candidates: [] }
    }
  })

  let itemsForValidation = itemsWithProjectPrep
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .or('status.is.null,status.eq.active')

    if (error) throw error

    const rows = Array.isArray(data) ? data : []
    itemsForValidation = itemsWithProjectPrep.map(item => {
      if (!item.project_label || item.project_label.trim().length < 3) return item

      const labelKey = normalizeProjectMatchKey(item.project_label)
      if (!labelKey) return item

      const matches = []
      for (const row of rows) {
        const nameKey = normalizeProjectMatchKey(row.name)
        if (!nameKey) continue
        if (nameKey === labelKey) {
          matches.push({ row, kind: 'exact', score: 1 })
        } else if (nameKey.includes(labelKey) || labelKey.includes(nameKey)) {
          matches.push({ row, kind: 'contains', score: 0.7 })
        }
      }

      if (!matches.length) return item

      const hasExact = matches.some(m => m.kind === 'exact')
      const pool = hasExact ? matches.filter(m => m.kind === 'exact') : matches

      pool.sort((a, b) => {
        const lenA = normalizeProjectMatchKey(a.row.name).length
        const lenB = normalizeProjectMatchKey(b.row.name).length
        if (lenA !== lenB) return lenA - lenB
        return String(a.row.id).localeCompare(String(b.row.id))
      })

      const best = pool[0]
      const winner = best.row

      return {
        ...item,
        project_resolution: {
          resolved_id: winner.id,
          candidates: [{ id: winner.id, name: winner.name, score: best.score }]
        }
      }
    })
  } catch {
    // leave itemsForValidation as itemsWithProjectPrep
  }

  for (const item of itemsForValidation) {
    console.log('[clara review] project_resolution', item.temp_id, item.project_resolution)
  }

  const validatedItems = enrichReviewItemsWithValidation(itemsForValidation)
  const enrichedItems = await addDuplicateWarningsToReviewItems(validatedItems)
  const blocked = enrichedItems.find(item => item.invalid_fields.length > 0)

  const review = {
    summary: safeString(aiResult?.review?.summary, 'Ik heb dit alvast klaargezet.'),
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
      .from(TABLE_NAME)
      .delete()
      .eq('id', itemId)
      .select('id, title, type')

    if (error) throw new Error(`delete_failed: ${error.message}`)

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

  if (!title) throw new Error('delete_failed: missing id and title')

  let query = supabase
    .from(TABLE_NAME)
    .delete()
    .eq('type', type)
    .eq('title', title)

  if (date) query = query.eq('date', date)
  if (time) query = query.eq('time', time)
  if (project) query = query.eq('project', project)

  const { data, error } = await query.select('id, title, type')
  if (error) throw new Error(`delete_failed: ${error.message}`)

  return {
    deleted: data?.length || 0,
    item: data?.[0] || null
  }
}

async function updateItem(body) {
  const itemId = safeString(body.id || body.item_id)
  if (!itemId) throw new Error('update_failed: missing id')

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
    note_type: cleaned.type === 'notitie' ? 'general' : '',
    raw: cleaned.source_text,
    source_text: cleaned.source_text,
    updated_at: now
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updatePayload)
    .eq('id', itemId)
    .select()
    .single()

  if (error) throw new Error(`update_failed: ${error.message}`)

  return data
}

async function findExactExistingMatches(items) {
  const matchMap = new Map()

  for (const item of items) {
    let query = supabase
      .from(TABLE_NAME)
      .select('id, type, title, summary, project, date, time')
      .eq('type', item.type)
      .eq('title', item.title)
      .eq('date', item.date)
      .eq('time', item.time)
      .limit(5)

    if (item.project) {
      query = query.eq('project', item.project)
    } else {
      query = query.eq('project', '')
    }

    const { data, error } = await query
    if (error) throw new Error(`dedupe_lookup_failed: ${error.message}`)

    if (data?.length) {
      matchMap.set(buildDedupeKey(item), data[0])
    }
  }

  return matchMap
}

async function findSmartDuplicateMatches(items) {
  const candidates = await findReviewDuplicateCandidates(items)
  const matchMap = new Map()

  for (const item of items) {
    const match = detectDuplicateMatch(item, candidates)
    if (match.duplicate_warning && match.duplicate_match_id) {
      matchMap.set(buildDedupeKey(item), match)
    }
  }

  return matchMap
}

function summarizeSavedResult(savedCount, skippedCount) {
  if (savedCount && skippedCount) return `Opgeslagen. ${savedCount} nieuw, ${skippedCount} dubbel overgeslagen.`
  if (savedCount) return 'Opgeslagen.'
  if (skippedCount) return 'Dubbel herkend. Ik heb niets extra opgeslagen.'
  return 'Niets nieuws opgeslagen.'
}

async function confirmReview(body) {
  const items = Array.isArray(body.items) ? body.items : []
  if (!items.length) throw new Error('no_items_to_save')

  const cleanedItems = items.map((item, index) => ({
    temp_id: safeString(item?.temp_id, `item_${index + 1}`),
    ...sanitizeItemForSave(item)
  }))

  const uniqueMap = new Map()
  for (const item of cleanedItems) {
    const key = buildDedupeKey(item)
    if (!uniqueMap.has(key)) uniqueMap.set(key, item)
  }

  const uniqueItems = Array.from(uniqueMap.values())
  const validatedItems = enrichReviewItemsWithValidation(uniqueItems)
  const enrichedItems = await addDuplicateWarningsToReviewItems(validatedItems)
  const blocked = enrichedItems.find(item => item.invalid_fields.length > 0)

  if (blocked) {
    return {
      blocked: true,
      response: buildResponse(body, {
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
    }
  }

  const exactExistingMatches = await findExactExistingMatches(uniqueItems)
  const smartDuplicateMatches = await findSmartDuplicateMatches(uniqueItems)

  const skippedDuplicates = []
  const inserts = []
  const now = new Date().toISOString()

  for (const item of uniqueItems) {
    const key = buildDedupeKey(item)

    if (exactExistingMatches.has(key)) {
      const match = exactExistingMatches.get(key)
      skippedDuplicates.push({
        type: item.type,
        title: item.title,
        duplicate_match_id: match?.id || '',
        duplicate_match_title: match?.title || '',
        duplicate_match_reason: 'exacte match'
      })
      continue
    }

    if (smartDuplicateMatches.has(key)) {
      const match = smartDuplicateMatches.get(key)
      skippedDuplicates.push({
        type: item.type,
        title: item.title,
        duplicate_match_id: match?.duplicate_match_id || '',
        duplicate_match_title: match?.duplicate_match_title || '',
        duplicate_match_reason: match?.duplicate_match_reason || 'waarschijnlijk dubbel'
      })
      continue
    }

    inserts.push({
      type: item.type,
      title: item.title,
      summary: item.summary,
      project: item.project,
      status: item.status,
      date: item.date,
      end_date: item.end_date,
      time: item.time,
      priority: item.priority,
      note_type: item.type === 'notitie' ? 'general' : '',
      raw: item.source_text,
      source_text: item.source_text,
      created_at: now,
      updated_at: now
    })
  }

  if (!inserts.length) {
    const text = summarizeSavedResult(0, skippedDuplicates.length)
    return {
      blocked: false,
      response: buildResponse(body, {
        ok: true,
        mode: 'confirmation',
        reply: text,
        confirmation: {
          text,
          saved: [],
          skipped_duplicates: skippedDuplicates
        },
        review: null,
        actions: [],
        meta: {
          needs_clarification: false,
          confidence: 1,
          can_save: false
        }
      })
    }
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(inserts)
    .select()

  if (error) throw new Error(`save_failed: ${error.message}`)

  const savedCount = Array.isArray(data) ? data.length : 0
  const skippedCount = skippedDuplicates.length
  const confirmationText = summarizeSavedResult(savedCount, skippedCount)

  return {
    blocked: false,
    response: buildResponse(body, {
      ok: true,
      mode: 'confirmation',
      reply: null,
      confirmation: {
        text: confirmationText,
        saved: (data || []).map(item => ({
          id: item.id,
          type: item.type,
          title: item.title
        })),
        skipped_duplicates: skippedDuplicates
      },
      review: null,
      actions: [],
      meta: {
        needs_clarification: false,
        confidence: 1,
        can_save: false
      }
    })
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const message = safeString(body.message)
    const action = safeString(body.action)

    if (!message && !action) {
      return res.status(400).json({ error: 'missing_input' })
    }

    if (!action) {
      const aiResult = await parseWithOpenAI(message)
      const normalized = await normalizeReviewPayload(aiResult)

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
      const result = await confirmReview(body)
      return res.status(200).json(result.response)
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

    return res.status(400).json({ error: 'unknown_action' })
  } catch (error) {
    const message = safeString(error?.message)
    const stack = safeString(error?.stack)

    if (message === 'no_items_to_save') {
      return res.status(400).json({ error: 'no_items_to_save' })
    }

    return res.status(500).json({
      ok: false,
      success: false,
      mode: 'reply',
      reply: `DEBUG ERROR: ${message || 'unknown error'}`,
      debug: {
        message,
        stack
      },
      meta: {
        needs_clarification: false,
        confidence: 0,
        can_save: false,
        error_code: 'SERVER_ERROR'
      }
    })
  }
}
