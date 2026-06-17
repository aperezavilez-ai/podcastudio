import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { callClaude } from './lib/ai/claude.js'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function aiApiDev(apiKey) {
  return {
    name: 'ai-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/ai')) return next()

        if (req.url === '/api/ai/status' || req.url.startsWith('/api/ai/status?')) {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            configured: !!apiKey,
            provider: 'claude',
            model: 'claude-sonnet-4-6',
          }))
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        try {
          if (!apiKey) {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Añade ANTHROPIC_API_KEY en .env.local' }))
            return
          }
          const body = await readBody(req)
          const text = await callClaude({ prompt: body.prompt, systemPrompt: body.systemPrompt, apiKey })
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ text }))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e.message || 'Error IA' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), aiApiDev(env.ANTHROPIC_API_KEY)],
    server: { port: 3000 },
  }
})
