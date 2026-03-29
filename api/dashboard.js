const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function parseDate(value) {
  if (!value) return null
  const str = String(value).trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  return null
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
          (row.time || '').toLowerCase().trim(),
          (row.summary || '').toLowerCase().trim()
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
        details: error.message,
        hint: error.hint || null,
        code: error.code || null
      })
    }

    const rows = dedupeRows(Array.isArray(data) ? data : [])
    const today = getTodayStart()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const agenda = rows.filter(item => {
      const type = (item.type || '').toLowerCase()
      const itemDate = parseDate(item.date)
      if (!itemDate) return false

      const isAppointment = ['agenda', 'afspraak'].includes(type)
      const isDatedTask = ['task', 'taak'].includes(type)

      if (!isAppointment && !isDatedTask) return false
      return itemDate >= today && itemDate < nextWeek
    })

    const tasks = rows.filter(item => {
      const type = (item.type || '').toLowerCase()
      const status = (item.status || '').toLowerCase()
      return ['task', 'taak'].includes(type) && !['klaar', 'done'].includes(status)
    })

    const notes = rows.filter(item => {
      const type = (item.type || '').toLowerCase()
      return ['note', 'notitie', 'project', 'idee'].includes(type)
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
}        return itemDate >= today && itemDate < weekEnd
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
