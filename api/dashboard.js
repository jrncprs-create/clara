const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function getAmsterdamToday() {
  const now = new Date()
  const amsterdamString = now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  const amsterdamNow = new Date(amsterdamString)

  const year = amsterdamNow.getFullYear()
  const month = String(amsterdamNow.getMonth() + 1).padStart(2, '0')
  const day = String(amsterdamNow.getDate()).padStart(2, '0')

  return new Date(`${year}-${month}-${day}T00:00:00`)
}

function parseDateValue(value) {
  if (!value) return null

  const str = String(value).trim()
  if (!str) return null

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`)
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
        details: error.message,
        hint: error.hint || null,
        code: error.code || null
      })
    }

    const rows = Array.isArray(data) ? data : []
    const today = getAmsterdamToday()
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const agenda = rows
      .filter(item => {
        const type = (item.type || '').toLowerCase()
        const itemDate = parseDateValue(item.date)

        const isAgendaType = ['agenda', 'afspraak'].includes(type)
        const isDatedTask = ['task', 'taak'].includes(type) && itemDate

        if (!isAgendaType && !isDatedTask) return false
        if (!itemDate) return false

        return itemDate >= today && itemDate < weekEnd
      })
      .sort((a, b) => {
        const dateA = parseDateValue(a.date)
        const dateB = parseDateValue(b.date)

        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1

        return dateA - dateB
      })

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
