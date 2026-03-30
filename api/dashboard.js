import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function normalizeType(type) {
  return String(type || '').trim().toLowerCase()
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('clara_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + 7)

    const agenda = data
      .filter((item) => {
        const itemDate = parseDate(item.datum)
        if (!itemDate) return false
        return itemDate >= today && itemDate < weekEnd
      })
      .sort((a, b) => new Date(a.datum) - new Date(b.datum))

    const tasks = data
      .filter((item) => normalizeType(item.type) === 'taak')
      .slice(0, 12)

    const notes = data
      .filter((item) => {
        const type = normalizeType(item.type)
        return type === 'notitie' || type === 'idee' || type === 'project'
      })
      .slice(0, 12)

    res.status(200).json({
      agenda,
      tasks,
      notes,
      all: data
    })
  } catch (err) {
    res.status(500).json({
      error: err.message
    })
  }
}
