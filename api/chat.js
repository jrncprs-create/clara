const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function normalizeType(type = '') {
  const t = String(type).toLowerCase().trim()

  if (['taak', 'task', 'todo', 'to-do'].includes(t)) return 'taak'
  if (['afspraak', 'agenda', 'meeting', 'call'].includes(t)) return 'afspraak'
  if (['notitie', 'note', 'memo'].includes(t)) return 'notitie'
  if (['idee', 'idea'].includes(t)) return 'idee'
  if (['project'].includes(t)) return 'project'

  return 'notitie'
}

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  if (!Array.isArray(data.output)) return ''

  const parts = []

  for (const item of data.output) {
    if (!item || !Array.isArray(item.content)) continue

    for (const content of item.content) {
      if (!content) continue
      if (content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text)
      }
    }
  }

  return parts.join('\n').trim()
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const message = safeString(body.message).trim()

    if (!message) {
      return res.status(400).json({ error: 'missing_message' })
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        reply: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string' },
              title: { type: 'string' },
              summary: { type: 'string' },
              project: { type: 'string' },
              status: { type: 'string' },
              date: { type: 'string' },
              time: { type: 'string' },
              note_type: { type: 'string' },
              raw: { type: 'string' }
            },
            required: [
              'type',
              'title',
              'summary',
              'project',
              'status',
              'date',
              'time',
              'note_type',
              'raw'
            ]
          }
        }
      },
      required: ['reply', 'items']
    }

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        instructions: [
          'Je bent Clara, een persoonlijke AI-operator voor Jeroen Cuypers van Begeister.',
          'Zet input om in bruikbare items voor een dashboard.',
          'Herken taken, afspraken, notities, ideeën en projecten.',
          'Gebruik Nederlands.',
          'Wees kort en direct.',
          'Als iets een afspraak is, gebruik type "afspraak".',
          'Als iets een taak is, gebruik type "taak".',
          'Als iets een notitie is, gebruik type "notitie".',
          'Als iets een idee is, gebruik type "idee".',
          'Als iets een project is, gebruik type "project".',
          'Gebruik lege strings als informatie ontbreekt.',
          'Geef in reply een korte menselijke reactie van maximaal 2 zinnen.',
          'Maak title kort en duidelijk.',
          'Maak summary compact.',
          'Zet de originele gebruikersinput ook in raw.'
        ].join('\n'),
        input: message,
        text: {
          format: {
            type: 'json_schema',
            strict: true,
            name: 'clara_chat_output',
            schema
          }
        }
      })
    })

    const openaiData = await openaiRes.json()

    if (!openaiRes.ok) {
      return res.status(500).json({
        error: 'openai_error',
        details: openaiData
      })
    }

    const rawText = extractOutputText(openaiData)

    if (!rawText) {
      return res.status(500).json({
        error: 'missing_model_output',
        details: openaiData
      })
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch (err) {
      return res.status(500).json({
        error: 'invalid_model_json',
        rawText
      })
    }

    const reply = safeString(parsed.reply, 'Opgeslagen.')
    const items = Array.isArray(parsed.items) ? parsed.items : []

    const cleanedItems = items.map((item) => ({
      type: normalizeType(item.type),
      title: safeString(item.title, 'Zonder titel'),
      summary: safeString(item.summary),
      project: safeString(item.project),
      status: safeString(item.status, 'nieuw') || 'nieuw',
      date: safeString(item.date),
      time: safeString(item.time),
      note_type: safeString(item.note_type, 'general') || 'general',
      raw: safeString(item.raw, message)
    }))

    let inserted = []

    if (cleanedItems.length) {
      const { data, error } = await supabase
        .from('clara_items')
        .insert(cleanedItems)
        .select('*')

      if (error) {
        return res.status(500).json({
          error: 'supabase_error',
          details: error.message,
          hint: error.hint || null,
          code: error.code || null
        })
      }

      inserted = Array.isArray(data) ? data : []
    }

    return res.status(200).json({
      success: true,
      reply,
      items: inserted
    })
  } catch (e) {
    return res.status(500).json({
      error: 'server_error',
      details: e.message
    })
  }
}
