const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

module.exports = async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('clara_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({
        error: 'supabase_error',
        details: error.message,
        hint: error.hint || null,
        code: error.code || null
      })
    }

    const rows = Array.isArray(data) ? data : []

    const agenda = rows.filter(item =>
      ['agenda', 'afspraak'].includes((item.type || '').toLowerCase())
    )

    const tasks = rows.filter(item =>
      ['task', 'taak'].includes((item.type || '').toLowerCase())
    )

    const notes = rows.filter(item =>
      ['note', 'notitie', 'project', 'idee'].includes((item.type || '').toLowerCase())
    )

    return res.status(200).json({
      agenda,
      tasks,
      notes
    })
  } catch (e) {
    return res.status(500).json({
      error: 'server_error',
      details: e.message
    })
  }
}
