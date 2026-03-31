const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

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

function pad2(n) {
  return String(n).padStart(2, '0')
}

function getAmsterdamDateParts(baseDate = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
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

function makeUTCDateFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day))
}

function getAmsterdamTodayUTC() {
  const { year, month, day } = getAmsterdamDateParts(new Date())
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

function extractRelativeDateFromText(text) {
  const raw = safeString(text).toLowerCase()
  if (!raw) return ''

  const today = getAmsterdamTodayUTC()

  if (/\bovermorgen\b/.test(raw)) {
    return formatUTCDateYMD(addDaysUTC(today, 2))
  }

  if (/\bmorgen\b/.test(raw)) {
    return formatUTCDateYMD(addDaysUTC(today, 1))
  }

  if (/\bvandaag\b/.test(raw)) {
    return formatUTCDateYMD(today)
  }

  return ''
}

function extractExplicitDateFromText(text) {
  const raw = safeString(text)
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

  return ''
}

function normalizeDate(input) {
  const raw = safeString(input)
  if (!raw) return ''

  const explicit = normalizeExplicitDateString(raw)
  if (explicit) return explicit

  const relative = extractRelativeDateFromText(raw)
  if (relative) return relative

  const embeddedExplicit = extractExplicitDateFromText(raw)
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

  return ''
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
