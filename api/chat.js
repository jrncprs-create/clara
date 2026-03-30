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
      return res.status(200).json(review)
    }

    if (action === 'confirm_review') {
      const items = Array.isArray(body.items) ? body.items : []

      if (!items.length) {
        return res.status(400).json({ error: 'no_items_to_save' })
      }

      const now = new Date().toISOString()

      const inserts = items.map(item => ({
        type: normalizeType(item.type),
        title: safeString(item.title, 'Zonder titel'),
        summary: safeString(item.summary),
        project: safeString(item.project),
        status: safeString(item.status, 'nieuw'),
        date: safeString(item.date),
        end_date: safeString(item.end_date),
        time: safeString(item.time),
        priority: safeString(item.priority, 'middel'),
        note_type: 'general',
        raw: safeString(item.source_text),
        source_text: safeString(item.source_text),
        created_at: now,
        updated_at: now
      }))

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
