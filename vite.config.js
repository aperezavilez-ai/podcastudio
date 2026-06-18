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

function aiApiDev(env) {
  const apiKey = env.ANTHROPIC_API_KEY
  return {
    name: 'ai-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        if (req.url === '/api/email/status' || req.url.startsWith('/api/email/status?')) {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          const configured = !!env.RESEND_API_KEY
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            configured,
            from: configured ? (env.RESEND_FROM_EMAIL || 'PodcastStudio <onboarding@resend.dev>') : null,
            provider: 'resend',
            types: ['welcome', 'project_ready', 'recording_ready', 'live_started'],
          }))
          return
        }

        if (req.url === '/api/email/send' || req.url.startsWith('/api/email/send?')) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          try {
            if (!env.RESEND_API_KEY) {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Añade RESEND_API_KEY en .env.local' }))
              return
            }
            const body = await readBody(req)
            const { sendNotificationEmail } = await import('./lib/email/resend.js')
            const result = await sendNotificationEmail({
              type: body.type,
              to: body.to,
              data: body.data || {},
              apiKey: env.RESEND_API_KEY,
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, id: result.id }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message || 'Error email' }))
          }
          return
        }

        if (req.url === '/api/stripe/status' || req.url.startsWith('/api/stripe/status?')) {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          const configured = !!env.STRIPE_SECRET_KEY
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ configured, provider: 'stripe', currency: 'usd' }))
          return
        }

        if (req.url?.startsWith('/api/stripe/session')) {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          try {
            if (!env.STRIPE_SECRET_KEY) throw new Error('Añade STRIPE_SECRET_KEY en .env.local')
            const url = new URL(req.url, 'http://localhost')
            const sessionId = url.searchParams.get('session_id')
            const { retrieveCheckoutSession } = await import('./lib/stripe/client.js')
            const session = await retrieveCheckoutSession(sessionId)
            const paid = session.payment_status === 'paid' || session.status === 'complete'
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              ok: paid,
              planId: session.metadata?.planId || null,
              customerEmail: session.customer_details?.email || session.customer_email,
            }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }

        if (req.url === '/api/stripe/checkout' || req.url.startsWith('/api/stripe/checkout?')) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          try {
            if (!env.STRIPE_SECRET_KEY) throw new Error('Añade STRIPE_SECRET_KEY en .env.local')
            const body = await readBody(req)
            const { createCheckoutSession } = await import('./lib/stripe/client.js')
            const session = await createCheckoutSession({ planId: body.planId, customerEmail: body.email })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ url: session.url, sessionId: session.id }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }

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
    plugins: [react(), aiApiDev(env)],
    server: { port: 3000 },
  }
})
