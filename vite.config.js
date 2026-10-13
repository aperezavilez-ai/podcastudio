import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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

function mercadopagoDevHandlers(env) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/api/mercadopago/status') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
      const { isMercadoPagoConfigured } = await import('./lib/mercadopago/client.js')
      const { isSupabaseAdminConfigured } = await import('./lib/supabase/admin.js')
      const { PLANS } = await import('./src/config/plans.js')
      return json(res, 200, {
        configured: isMercadoPagoConfigured(),
        webhook: !!env.MERCADO_PAGO_WEBHOOK_SECRET,
        supabaseSync: isSupabaseAdminConfigured(),
        provider: 'mercadopago',
        currency: 'MXN',
        plans: PLANS.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          interval: p.interval,
          billed: p.billed,
        })),
      })
    }

    if (url.pathname === '/api/mercadopago/session') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
      try {
        if (!env.MERCADO_PAGO_ACCESS_TOKEN) throw new Error('Añade MERCADO_PAGO_ACCESS_TOKEN en .env.local')
        const paymentId = url.searchParams.get('payment_id')
        const { getPayment } = await import('./lib/mercadopago/client.js')
        const payment = await getPayment(paymentId)
        const approved = payment.status === 'approved'
        return json(res, 200, {
          ok: approved,
          planId: payment.metadata?.plan_id || null,
          customerEmail: payment.payer?.email,
        })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/mercadopago/checkout') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        if (!env.MERCADO_PAGO_ACCESS_TOKEN) throw new Error('Añade MERCADO_PAGO_ACCESS_TOKEN en .env.local')
        const body = await readBody(req)
        const { createPreference } = await import('./lib/mercadopago/client.js')
        const preference = await createPreference({
          planId: body.planId,
          customerEmail: body.email,
          userId: body.userId,
        })
        return json(res, 200, { url: preference.init_point, preferenceId: preference.id })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/mercadopago/subscription') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
      try {
        const { getUserFromAuthHeader } = await import('./lib/supabase/auth.js')
        const { getSubscriptionByUserId, isActivePayment } = await import('./lib/mercadopago/subscriptions.js')
        const user = await getUserFromAuthHeader(req.headers.authorization)
        if (!user) return json(res, 401, { error: 'No autorizado' })
        const sub = await getSubscriptionByUserId(user.id)
        return json(res, 200, {
          planId: sub?.plan_id || null,
          status: sub?.status || null,
          active: sub ? isActivePayment(sub.status) : false,
          currentPeriodEnd: sub?.current_period_end || null,
          hasMPPreference: !!sub?.mp_preference_id,
        })
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/mercadopago/sync') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        const { getUserFromAuthHeader } = await import('./lib/supabase/auth.js')
        const { syncPaymentForUser } = await import('./lib/mercadopago/sync.js')
        const user = await getUserFromAuthHeader(req.headers.authorization)
        if (!user) return json(res, 401, { error: 'Inicia sesión para activar tu plan' })
        const body = await readBody(req)
        const result = await syncPaymentForUser(body.paymentId, user.id)
        return json(res, 200, result)
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (url.pathname === '/api/mercadopago/webhook') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      try {
        const signature = req.headers['x-signature'] || req.headers['x-request-id']
        const rawBody = await readRawBody(req)
        const { handleMPWebhook } = await import('./lib/mercadopago/webhooks.js')
        const event = await handleMPWebhook(rawBody, signature)
        return json(res, 200, { received: true, type: event.type })
      } catch (e) {
        return json(res, 400, { error: e.message })
      }
    }

    return false
  }
}

function aiApiDev(env) {
  const apiKey = env.MEAI_API_KEY
  const model = env.MEAI_MODEL || 'claude-haiku-4-5'
  return {
    name: 'ai-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const apiUrl = new URL(req.url, 'http://localhost')

        const mpHandled = await mercadopagoDevHandlers(env)(req, res)
        if (mpHandled !== false) return

        if (apiUrl.pathname === '/api/auth/login') {
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
            provider: 'meai',
            model,
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
            res.end(JSON.stringify({ error: 'Añade MEAI_API_KEY en .env.local' }))
            return
          }
          const body = await readBody(req)
          const { callClaude } = await import('./lib/ai/claude.cjs')
          const text = await callClaude({ prompt: body.prompt, systemPrompt: body.systemPrompt, apiKey, model })
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
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vite 8 + Rolldown requiere función en lugar de objeto
            if (id.includes('node_modules')) {
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/react-router/') ||
                id.includes('/react-router-dom/') ||
                id.includes('/scheduler/')
              ) {
                return 'vendor-react'
              }
              if (id.includes('@supabase/supabase-js')) {
                return 'vendor-supabase'
              }
              if (id.includes('@ffmpeg/ffmpeg') || id.includes('@ffmpeg/util')) {
                return 'ffmpeg'
              }
              if (id.includes('@mediapipe/tasks-vision')) {
                return 'mediapipe'
              }
              if (id.includes('mammoth')) {
                return 'mammoth'
              }
              if (id.includes('lucide-react') || id.includes('framer-motion')) {
                return 'vendor-ui'
              }
            }
          }
        }
      },
      // Tree shaking mejorado
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : []
        }
      },
      // Chunks más grandes para menos requests
      chunkSizeWarningLimit: 1000,
    },
    // Optimización de dependencias
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
      exclude: ['@ffmpeg/ffmpeg', '@mediapipe/tasks-vision'] // Lazy load estas pesadas
    },
  }
})
