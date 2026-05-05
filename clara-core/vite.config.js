import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { createClaraStateApiMiddleware } from '../scripts/clara-state-api-middleware.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(__dirname, '../CLARA_STATE'),
  plugins: [
    {
      name: 'clara-state-api-dev',
      configureServer(server) {
        server.middlewares.use(createClaraStateApiMiddleware(repoRoot))
      },
    },
  ],
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
})
