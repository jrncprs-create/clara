const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

function getAmsterdamDateParts(offsetDays = 0) {
  const now = new Date()
  const amsterdamString = now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  const amsterdamNow = new Date(amsterdamString)
  amsterdamNow.setDate(amsterdamNow.getDate() + offsetDays)

  const year = amsterdamNow.getFullYear()
  const month = String(amsterdamNow.getMonth() + 1).padStart(2, '0')
  const day = String(amsterdamNow.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeDate(input) {
  if (!input) return ''

  const value = String(input).trim().toLowerCase()

  if (!value) return ''
  if (value === 'vandaag') return getAmsterdamDateParts(0)
  if (value === 'morgen') return getAmsterdamDateParts(1)
  if (value === 'overmorgen') return getAmsterdamDateParts(2)

  return String(input).trim()
}

function normalizeType(input) {
  const rawType = String(input || '').trim().toLowerCase()

  if (['task', 'taak', 'todo', 'to-do'].includes(rawType)) return 'taak'
  if (['agenda', 'afspraak', 'event', 'appointment'].includes(rawType)) return 'afspraak'
  if (['note', 'notitie', 'notes'].includes(rawType)) return 'notitie'
  if (['idea', 'idee', 'ideen'].includes(rawType)) return 'idee'
  if (['project', 'projects'].includes(rawType)) return 'project'

  return 'notitie'
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const normalizedDate = normalizeDate(body.date || body.datum || '')
    const normalizedEndDate = normalizeDate(body.end_date || body.eind_datum || body.einddatum || '')

    const item = {
      type: normalizeType(body.type),
      title: String(body.title || body.titel || body.name || 'Zonder titel').trim(),
      summary: String(body.summary || body.samenvatting || body.raw || '').trim(),
      project: String(body.project || '').trim(),
      status: String(body.status || 'nieuw').trim(),
      priority: String(body.priority || body.prioriteit || '').trim(),
      date: normalizedDate,
      end_date: normalizedEndDate,
      time: String(body.time || body.tijd || '').trim(),
      note_type: String(body.note_type || 'general').trim(),
      raw: String(body.raw || '').trim(),
      source_text: String(body.source_text || '').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('clara_items')
      .insert([item])
      .select()

    if (error) {
      return res.status(500).json({
        error: 'supabase_error',
        details: error.message,
        hint: error.hint || null,
        code: error.code || null,
        item
      })
    }

    return res.status(200).json({
      success: true,
      item: data?.[0] || item
    })
  } catch (e) {
    return res.status(500).json({
      error: 'server_error',
      details: e.message
    })
  }
}
