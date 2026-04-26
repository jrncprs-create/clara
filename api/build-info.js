module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const fullSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    ''

  const build = fullSha ? String(fullSha).slice(0, 7) : 'local'

  const createdAt =
    process.env.VERCEL_GIT_COMMIT_TIMESTAMP ||
    process.env.VERCEL_DEPLOYMENT_CREATED_AT ||
    process.env.BUILD_CREATED_AT ||
    null

  const environment =
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    'development'

  return res.status(200).json({
    build,
    created_at: createdAt,
    environment
  })
}
