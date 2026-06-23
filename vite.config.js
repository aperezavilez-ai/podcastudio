import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function stripeDevHandlers(env) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/api/stripe/status') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
      const { isStripeConfigured } = await import('./lib/stripe/client.js')
      const { isSupabaseAdminConfigured } = await import('./lib/supabase/admin.js')
      const { PLANS } = await import('./lib/stripe/plans.js')
      return json(res, 200, {
        configured: isStripeConfigured(),
        webhook: !!env.STRIPE_WEBHOOK_SECRET,
        supabaseSync: isSupabaseAdminConfigured(),
        provider: 'stripe',
        currency: 'usd',
        plans: PLANS.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          interval: p.interval,
          billed: p.billed,
        })),
      })
    }

    if (url.pathname === '/api/stripe/session') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
      try {
        if (!env.STRIPE_SECRET_KEY) throw new Error('Añade STRIPE_SECRET_KEY en .env.local')
        const sessionId = url.searchParams.get('session_id')
        const { retrieveCheckoutSession } = await import('./lib/stripe/client.js')
        const session = await retrieveCheckoutSession(sessionId)
        const paid = session.payment_status === 'paid' || session.status === 'complete'
        return json(res, 200, {
          ok: paid,
          planId: session.metadata?.planId || null,
          customerEmail: session.customer_details?.email || session.customer_email,
        })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/stripe/checkout') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        if (!env.STRIPE_SECRET_KEY) throw new Error('Añade STRIPE_SECRET_KEY en .env.local')
        const body = await readBody(req)
        const { createCheckoutSession } = await import('./lib/stripe/client.js')
        const session = await createCheckoutSession({
          planId: body.planId,
          customerEmail: body.email,
          userId: body.userId,
        })
        return json(res, 200, { url: session.url, sessionId: session.id })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/stripe/subscription') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
      try {
        const { getUserFromAuthHeader } = await import('./lib/supabase/auth.js')
        const { getSubscriptionByUserId, isActiveSubscription } = await import('./lib/stripe/subscriptions.js')
        const user = await getUserFromAuthHeader(req.headers.authorization)
        if (!user) return json(res, 401, { error: 'No autorizado' })
        const sub = await getSubscriptionByUserId(user.id)
        return json(res, 200, {
          planId: sub?.plan_id || null,
          status: sub?.status || null,
          active: sub ? isActiveSubscription(sub.status) : false,
          currentPeriodEnd: sub?.current_period_end || null,
          hasStripeCustomer: !!sub?.stripe_customer_id,
        })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/stripe/sync') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        const { getUserFromAuthHeader } = await import('./lib/supabase/auth.js')
        const { syncCheckoutSessionForUser } = await import('./lib/stripe/sync.js')
        const user = await getUserFromAuthHeader(req.headers.authorization)
        if (!user) return json(res, 401, { error: 'Inicia sesión para activar tu plan' })
        const body = await readBody(req)
        const result = await syncCheckoutSessionForUser(body.sessionId, user.id)
        return json(res, 200, result)
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/stripe/portal') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        if (!env.STRIPE_SECRET_KEY) throw new Error('Añade STRIPE_SECRET_KEY en .env.local')
        const { getUserFromAuthHeader } = await import('./lib/supabase/auth.js')
        const { getSubscriptionByUserId } = await import('./lib/stripe/subscriptions.js')
        const { createBillingPortalSession } = await import('./lib/stripe/client.js')
        const user = await getUserFromAuthHeader(req.headers.authorization)
        if (!user) return json(res, 401, { error: 'Inicia sesión' })
        const sub = await getSubscriptionByUserId(user.id)
        if (!sub?.stripe_customer_id) {
          return json(res, 404, { error: 'No tienes una suscripción activa en Stripe' })
        }
        const portal = await createBillingPortalSession(sub.stripe_customer_id)
        return json(res, 200, { url: portal.url })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/stripe/webhook') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        const signature = req.headers['stripe-signature']
        if (!signature) return json(res, 400, { error: 'Falta firma de Stripe' })
        const rawBody = await readRawBody(req)
        const { handleStripeWebhook } = await import('./lib/stripe/webhooks.js')
        const event = await handleStripeWebhook(rawBody, signature)
        return json(res, 200, { received: true, type: event.type })
      } catch (e) {
        return json(res, 400, { error: e.message })
      }
    }

    return false
  }
}

function aiApiDev(env) {
  const apiKey = env.ANTHROPIC_API_KEY
  return {
    name: 'ai-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const stripeHandled = await stripeDevHandlers(env)(req, res)
        if (stripeHandled !== false) return

        if (url.pathname === '/api/auth/login') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          try {
            const body = await readBody(req)
            const { serverSignIn } = await import('./lib/supabase/serverLogin.js')
            const data = await serverSignIn(body.email, body.password)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
              user: data.user,
            }))
          } catch (e) {
            const msg = (e?.message || '').toLowerCase()
            res.statusCode = msg.includes('invalid') ? 401 : 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e?.message || 'Error al iniciar sesión' }))
          }
          return
        }

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
  const appBuild = `${new Date().toISOString().slice(0, 10)}-${mode}`
  return {
    define: {
      __APP_BUILD__: JSON.stringify(appBuild),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'PodcastStudio',
          short_name: 'PodcastStudio',
          description: 'Estudio profesional de podcast con cámaras, grabación y transmisión en vivo',
          theme_color: '#e8612a',
          background_color: '#08080b',
          display: 'standalone',
          orientation: 'landscape',
          lang: 'es',
          start_url: '/',
          scope: '/',
          id: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
      aiApiDev(env),
    ],
    server: {
      port: 3000,
      host: true,
      strictPort: false,
    },
    preview: {
      port: 3000,
      host: true,
    },
  }
})
