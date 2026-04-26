module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable.'
    })
  }

  return res.status(200).json({
    ok: true,
    supabaseUrl,
    supabaseAnonKey
  })
}
