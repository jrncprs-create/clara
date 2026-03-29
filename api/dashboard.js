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
      throw error
    }

    const agenda = data.filter(item => item.type === 'agenda')
    const tasks = data.filter(item => item.type === 'task')
    const notes = data.filter(item => item.type === 'note')

    res.status(200).json({
      agenda,
      tasks,
      notes
    })
  } catch (err) {
    res.status(500).json({
      error: err.message || 'Unknown server error'
    })
  }
}
