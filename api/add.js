const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    const rawType = (body.type || '').toLowerCase()

    let normalizedType = rawType
    if (['task', 'taak'].includes(rawType)) normalizedType = 'taak'
    if (['agenda', 'afspraak'].includes(rawType)) normalizedType = 'afspraak'
    if (['note', 'notitie'].includes(rawType)) normalizedType = 'notitie'
    if (['idea', 'idee'].includes(rawType)) normalizedType = 'idee'
    if (['project'].includes(rawType)) normalizedType = 'project'

    const item = {
      type: normalizedType || 'notitie',
      title: body.title || 'Zonder titel',
      summary: body.summary || '',
      project: body.project || '',
      status: body.status || 'nieuw',
      date: body.date || '',
      time: body.time || '',
      note_type: body.note_type || 'general',
      raw: body.raw || ''
    }

    console.log('INSERT ITEM:', item)

    const { data, error } = await supabase
      .from('clara_items')
      .insert([item])

    if (error) {
      console.error('SUPABASE ERROR:', error)
      return res.status(500).json({
        error: 'supabase_error',
        details: error.message
      })
    }

    return res.status(200).json({
      success: true,
      inserted: item
    })

  } catch (e) {
    console.error('SERVER ERROR:', e)
    return res.status(500).json({
      error: 'server_error',
      details: e.message
    })
  }
}
