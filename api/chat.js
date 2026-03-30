const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

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
- Types: taak, afspraak, notitie, idee, project
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
        { role: 'system', content: 'Geef alleen JSON terug.' },
        { role: 'user', content: prompt }
      ]
    })
  })

  if (!response.ok) throw new Error('openai_failed')

  const json = await response.json()
  const content = json?.choices?.[0]?.message?.content || '{}'

  return JSON.parse(content)
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    const message = String(body.message || '').trim()
    const action = body.action

    if (!message && !action) {
      return res.status(400).json({ error: 'missing_input' })
    }

    // =========================
    // 1. REVIEW FLOW
    // =========================
    if (!action) {
      const review = await parseWithOpenAI(message)

      return res.status(200).json(review)
    }

    // =========================
    // 2. CONFIRM SAVE
    // =========================
    if (action === 'confirm_review') {
      const items = body.items || []

      const inserts = items.map(item => ({
        type: item.type,
        title: item.title,
        summary: item.summary,
        project: item.project || '',
        status: item.status || 'nieuw',
        date: item.date || '',
        time: item.time || '',
        priority: item.priority || 'middel',
        note_type: 'general'
      }))

      const { error } = await supabase
        .from('clara_items')
        .insert(inserts)

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          details: error.message
        })
      }

      return res.status(200).json({
        success: true,
        reply: 'Opgeslagen.',
        saved: inserts.length
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
