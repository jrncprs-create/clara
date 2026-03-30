const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function parseDate(value) {
  if (!value) return null

  const str = String(value).trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null

  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getTodayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function dedupeRows(rows) {
  const seen = new Set()
  const result = []

  for (const row of rows) {
    const key = row.id
      ? `id:${row.id}`
      : [
          (row.type || '').toLowerCase().trim(),
          (row.title || '').toLowerCase().trim(),
          (row.project || '').toLowerCase().trim(),
          (row.date || '').toLowerCase().trim(),
          (row.time || '').toLowerCase().trim()
        ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }

  return result
}

module.exports = async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('clara_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({
        error: 'supabase_error',
        details: error.message
      })
    }

    const rows = dedupeRows(Array.isArray(data) ? data : [])

    const today = getTodayStart()
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const agenda = rows.filter((item) => {
      const type = (item.type || '').toLowerCase()
      const itemDate = parseDate(item.date)

      if (!itemDate) return false

      const isRelevantType =
        type === 'afspraak' ||
        type === 'agenda' ||
        type === 'taak' ||
        type === 'task'

      if (!isRelevantType) return false

      return itemDate >= today && itemDate < weekEnd
    })

    const tasks = rows.filter((item) => {
      const type = (item.type || '').toLowerCase()
      const status = (item.status || '').toLowerCase()

      if (!(type === 'taak' || type === 'task')) return false
      if (status === 'klaar' || status === 'done') return false

      return true
    })

    const notes = rows.filter((item) => {
      const type = (item.type || '').toLowerCase()
      return ['note', 'notitie', 'idee', 'project'].includes(type)
    })

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
