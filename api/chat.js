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

function getAmsterdamNow() {
  return new Date()
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDateYMD(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function normalizeDutchRelativeDate(input) {
  const raw = safeString(input).toLowerCase()
  if (!raw) return ''

  const today = getAmsterdamNow()

  if (raw === 'vandaag') return formatDateYMD(today)
  if (raw === 'morgen') return formatDateYMD(addDays(today, 1))
  if (raw === 'overmorgen') return formatDateYMD(addDays(today, 2))

  return ''
}

function normalizeDate(input) {
  const raw = safeString(input)
  if (!raw) return ''

  const relative = normalizeDutchRelativeDate(raw)
  if (relative) return relative

  const trimmed = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  let match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    const day = pad2(match[1])
    const month = pad2(match[2])
    const year = match[3]
    return `${year}-${month}-${day}`
  }

  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const day = pad2(match[1])
    const month = pad2(match[2])
    const year = match[3]
    return `${year}-${month}-${day}`
  }

  match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (match) {
    const day = pad2(match[1])
    const month = pad2(match[2])
    const year = match[3]
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`
  }

  return ''
}

function normalizeTime(input) {
  const raw = safeString(input)
  if (!raw) return ''

  const trimmed = raw.trim().toLowerCase().replace('.', ':')

  if (/^\d{1,2}$/.test(trimmed)) {
    return `${pad2(trimmed)}:00`
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])

    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  return ''
}

function sanitizeItemForSave(item) {
  const normalizedDate = normalizeDate(item.date)
  const normalizedEndDate = normalizeDate(item.end_date)
  const normalizedTime = normalizeTime(item.time)

  return {
    type: normalizeType(item.type),
    title: safeString(item.title, 'Zonder titel'),
    summary: safeString(item.summary),
    project: safeString(item.project),
    status: safeString(item.status, 'nieuw'),
    date: normalizedDate,
    end_date: normalizedEndDate,
    time: normalizedTime,
    priority: safeString(item.priority, 'middel'),
    note_type: 'general',
    raw: safeString(item.source_text),
    source_text: safeString(item.source_text)
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
- Gebruik bij voorkeur voor date al YYYY-MM-DD als je zeker bent
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
    const action = body.action

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
