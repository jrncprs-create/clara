import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('clara_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + 7)

    const agenda = data.filter(item => {
      if (!item.datum) return false
      const itemDate = new Date(item.datum)
      return itemDate >= today && itemDate < weekEnd
    })

    const tasks = data.filter(item => item.type === 'taak')
    const notes = data.filter(item => item.type === 'notitie' || item.type === 'idee')

    res.status(200).json({
      agenda,
      tasks,
      notes
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
