const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

function safeString(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  return String(value).trim()
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

function sanitizeItemForSave(item) {
  const sourceText = safeString(item.source_text)
  const title = safeString(item.title, 'Zonder titel')
  const summary = safeString(item.summary)
  const project = safeString(item.project)
  const status = safeString(item.status, 'nieuw')
  const priority = safeString(item.priority, 'middel')

  const combinedText = [title, summary, sourceText].filter(Boolean).join(' | ')

  let date = normalizeDate(item.date)
  if (!date) date = normalizeDate(combinedText)

  let endDate = normalizeDate(item.end_date)
  if (!endDate) endDate = ''

  let time = normalizeTime(item.time)
  if (!time) time = extractTimeFromText(combinedText)

  return {
    type: normalizeType(item.type),
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
            status: 'nieuw',
            priority: 'middel',
            source_text: text
          }
        ]
      }
    }
  }

  const prompt = `
Je bent Clara.

Zet de input om naar een REVIEW JSON.

Regels:
- Splits input in meerdere items als nodig
- Types: taak, afspraak, notitie, idee, project, beslissing
- Geef GEEN uitleg, alleen JSON
- title = kort
- summary = 1 zin
- date/time alleen als zeker
- Gebruik bij voorkeur YYYY-MM-DD voor date en HH:MM voor time als het duidelijk is
- elk item krijgt temp_id
- source_text = exact stukje uit input

Formaat:
{
  "mode": "review",
  "reply": "",
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
        "status": "nieuw",
        "priority": "middel",
        "source_text": ""
      }
    ]
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
  let content = json?.choices?.[0]?.message?.content || '{}'
  content = content.trim()

  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  }

  return JSON.parse(content)
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
      const review = await parseWithOpenAI(message)

      if (review?.review?.items && Array.isArray(review.review.items)) {
        review.review.items = review.review.items.map(item => {
          const cleaned = sanitizeItemForSave(item)
          return {
            ...item,
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
      }

      return res.status(200).json(review)
    }

    if (action === 'confirm_review') {
      const items = Array.isArray(body.items) ? body.items : []

      if (!items.length) {
        return res.status(400).json({ error: 'no_items_to_save' })
      }

      const now = new Date().toISOString()

      const inserts = items.map(item => {
        const cleaned = sanitizeItemForSave(item)

        return {
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
          created_at: now,
          updated_at: now
        }
      })

      const { data, error } = await supabase
        .from('clara_items')
        .insert(inserts)
        .select()

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          details: error.message,
          hint: error.hint || null,
          code: error.code || null
        })
      }

      return res.status(200).json({
        success: true,
        reply: `Opgeslagen. ${data?.length || inserts.length} item(s).`,
        saved: data?.length || inserts.length
      })
    }

    return res.status(400).json({ error: 'unknown_action' })
  } catch (e) {
    return res.status(500).json({
      error: 'server_error',
      details: e.message
    })
  }
}
