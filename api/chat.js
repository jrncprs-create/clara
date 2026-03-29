const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function getAmsterdamDate(offsetDays = 0) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  local.setDate(local.getDate() + offsetDays)

  const year = local.getFullYear()
  const month = String(local.getMonth() + 1).padStart(2, '0')
  const day = String(local.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeDate(input) {
  if (!input) return ''
  const value = String(input).trim().toLowerCase()

  if (value === 'vandaag') return getAmsterdamDate(0)
  if (value === 'morgen') return getAmsterdamDate(1)
  if (value === 'overmorgen') return getAmsterdamDate(2)

  return input
}

function fallbackParse(text) {
  const raw = String(text || '').trim()
  const lower = raw.toLowerCase()

  let type = 'notitie'
  if (
    lower.includes('afspraak') ||
    lower.includes('call') ||
    lower.includes('meeting') ||
    lower.includes('overleg') ||
    /\b\d{1,2}:\d{2}\b/.test(lower)
  ) {
    type = 'afspraak'
  } else if (
    lower.includes('moet') ||
    lower.includes('taak') ||
    lower.includes('todo') ||
    lower.includes('opruimen') ||
    lower.includes('bellen') ||
    lower.includes('afronden')
  ) {
    type = 'taak'
  }

  let date = ''
  if (lower.includes('vandaag')) date = 'vandaag'
  if (lower.includes('morgen')) date = 'morgen'
  if (lower.includes('overmorgen')) date = 'overmorgen'

  const timeMatch = raw.match(/\b(\d{1,2}:\d{2})\b/)
  const time = timeMatch ? timeMatch[1] : ''

  return {
    type,
    title: raw.slice(0, 80) || 'Zonder titel',
    summary: raw,
    project: '',
    status: 'nieuw',
    date,
    time,
    raw
  }
}

async function parseWithOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) return fallbackParse(text)

  const today = getAmsterdamDate(0)

  const prompt = `
Je bent Clara.
Zet de input om naar 1 JSON object.

Regels:
- Geef alleen geldige JSON terug
- Types alleen: taak, afspraak, notitie, idee, project
- title moet kort en helder zijn
- summary is 1 korte zin
- project alleen invullen als expliciet genoemd
- status standaard "nieuw"
- date alleen invullen als het echt in de tekst staat of direct afleidbaar is
- Gebruik voor relatieve datumwoorden een echte datum in formaat YYYY-MM-DD
- Vandaag in Amsterdam is ${today}
- time alleen als expliciet genoemd in HH:MM
- raw moet exact de originele input zijn

Formaat:
{
  "type": "",
  "title": "",
  "summary": "",
  "project": "",
  "status": "nieuw",
  "date": "",
  "time": "",
  "raw": ""
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
        {
          role: 'system',
          content: 'Geef alleen JSON terug.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    return fallbackParse(text)
  }

  const json = await response.json()
  const content = json?.choices?.[0]?.message?.content || '{}'

  try {
    const parsed = JSON.parse(content)
    return {
      type: parsed.type || 'notitie',
      title: parsed.title || text.slice(0, 80) || 'Zonder titel',
      summary: parsed.summary || text,
      project: parsed.project || '',
      status: parsed.status || 'nieuw',
      date: parsed.date || '',
      time: parsed.time || '',
      raw: parsed.raw || text
    }
  } catch {
    return fallbackParse(text)
  }
}

function buildReply(item) {
  const type = (item.type || '').toLowerCase()
  const title = item.title || 'Zonder titel'

  if (type === 'afspraak') {
    if (item.date && item.time) return `Afspraak opgeslagen: ${title} op ${item.date} om ${item.time}.`
    if (item.date) return `Afspraak opgeslagen: ${title} op ${item.date}.`
    return `Afspraak opgeslagen: ${title}.`
  }

  if (type === 'taak') {
    if (item.date && item.time) return `ToDo opgeslagen: ${title} op ${item.date} om ${item.time}.`
    if (item.date) return `ToDo opgeslagen: ${title} voor ${item.date}.`
    return `ToDo opgeslagen: ${title}.`
  }

  if (type === 'idee') return `Idee opgeslagen: ${title}.`
  if (type === 'project') return `Project opgeslagen: ${title}.`

  return `Notitie opgeslagen: ${title}.`
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const message = String(body.message || '').trim()

    if (!message) {
      return res.status(400).json({ error: 'missing_message' })
    }

    const parsed = await parseWithOpenAI(message)

    const item = {
      type: parsed.type || 'notitie',
      title: parsed.title || 'Zonder titel',
      summary: parsed.summary || message,
      project: parsed.project || '',
      status: parsed.status || 'nieuw',
      date: normalizeDate(parsed.date || ''),
      time: parsed.time || '',
      note_type: 'general',
      raw: parsed.raw || message
    }

    const { data, error } = await supabase
      .from('clara_items')
      .insert([item])
      .select()
      .single()

    if (error) {
      return res.status(500).json({
        error: 'supabase_error',
        details: error.message
      })
    }

    return res.status(200).json({
      success: true,
      reply: buildReply(item),
      item: data || item
    })
  } catch (e) {
    return res.status(500).json({
      error: 'server_error',
      details: e.message
    })
  }
}
