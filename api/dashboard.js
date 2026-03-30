import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

function normalizeType(type) {
  return String(type || '').trim().toLowerCase()
}

function normalizePriority(priority) {
  const p = String(priority || '').trim().toLowerCase()

  if (['hoog', 'high', 'urgent', 'dringend', '1'].includes(p)) return 1
  if (['middel', 'medium', 'gemiddeld', '2'].includes(p)) return 2
  if (['laag', 'low', '3'].includes(p)) return 3

  return 9
}

function parseDate(value) {
  if (!value) return null

  const str = String(value).trim().toLowerCase()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (str === 'vandaag') return today

  if (str === 'morgen') {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d
  }

  if (str === 'overmorgen') {
    const d = new Date(today)
    d.setDate(d.getDate() + 2)
    return d
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseTimeToMinutes(value) {
  if (!value) return 9999

  const str = String(value).trim().toLowerCase()

  if (
    str === 'hele dag' ||
    str === 'allday' ||
    str === 'all day' ||
    str === 'ganse dag'
  ) {
    return 0
  }

  const match = str.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return 9999

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 9999
  }

  return hours * 60 + minutes
}

function toTimestamp(item) {
  if (!item?.created_at) return 0
  const t = new Date(item.created_at).getTime()
  return Number.isNaN(t) ? 0 : t
}

function dedupeItems(items) {
  const seen = new Set()
  const result = []

  for (const item of items || []) {
    const key = item.id
      ? `id:${item.id}`
      : [
          normalizeType(item.type),
          String(item.title || '').trim().toLowerCase(),
          String(item.project || '').trim().toLowerCase(),
          String(item.date || '').trim().toLowerCase(),
          String(item.time || '').trim().toLowerCase(),
          String(item.summary || '').trim().toLowerCase()
        ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('clara_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const allItems = dedupeItems(Array.isArray(data) ? data : [])

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + 7)

    const agenda = allItems
      .filter((item) => {
        const type = normalizeType(item.type)
        const itemDate = parseDate(item.date)

        if (!itemDate) return false

        return (
          (type === 'afspraak' || type === 'agenda') &&
          itemDate >= today &&
          itemDate < weekEnd
        )
      })
      .sort((a, b) => {
        const dateA = parseDate(a.date)
        const dateB = parseDate(b.date)

        const dayDiff = dateA - dateB
        if (dayDiff !== 0) return dayDiff

        const timeDiff = parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
        if (timeDiff !== 0) return timeDiff

        return toTimestamp(b) - toTimestamp(a)
      })
      .slice(0, 50)

    const tasks = allItems
      .filter((item) => normalizeType(item.type) === 'taak')
      .sort((a, b) => {
        const prioDiff = normalizePriority(a.priority) - normalizePriority(b.priority)
        if (prioDiff !== 0) return prioDiff

        const dateA = parseDate(a.date)
        const dateB = parseDate(b.date)

        if (dateA && dateB) {
          const dayDiff = dateA - dateB
          if (dayDiff !== 0) return dayDiff

          const timeDiff = parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
          if (timeDiff !== 0) return timeDiff
        }

        if (dateA && !dateB) return -1
        if (!dateA && dateB) return 1

        return toTimestamp(b) - toTimestamp(a)
      })
      .slice(0, 12)

    const notes = allItems
      .filter((item) => {
        const type = normalizeType(item.type)
        return type === 'notitie' || type === 'idee' || type === 'project'
      })
      .sort((a, b) => toTimestamp(b) - toTimestamp(a))
      .slice(0, 12)

    res.status(200).json({
      agenda,
      tasks,
      notes,
      all: allItems
    })
  } catch (err) {
    res.status(500).json({
      error: err.message
    })
  }
}
