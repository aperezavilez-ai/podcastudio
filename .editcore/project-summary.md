# Podcastudio — Resumen técnico para contexto rápido

> Generado automáticamente para reducir consumo de tokens. No editar a mano; se regenera tras cambios mayores.

## Stack y entry points
- **Frontend**: React 19, Vite 8, React Router 7, PWA (vite-plugin-pwa)
- **Backend/BaaS**: Supabase (Auth, DB, Realtime)
- **Pagos**: Stripe Checkout + Webhooks
- **IA**: Claude API vía endpoint `/api/ai` (dev en vite.config.js)
- **Email**: Resend vía `/api/email`
- **Media opcional**: Mux (upload VOD), YouTube OAuth, Livepeer, Restream
- **Deploy**: Vercel (push a `main`)

**Entry**: `index.html` → `src/main.jsx` → `src/App.jsx`
**Puerto dev**: 3000 (`vite.config.js:348`)

## Scripts
```json
"dev": "vite", "build": "vite build", "preview": "vite preview"
```

## Dependencias clave (package.json)
| Prod | Dev |
|------|-----|
| @ffmpeg/ffmpeg, @ffmpeg/util | @vitejs/plugin-react |
| @mediapipe/tasks-vision | sharp |
| @mux/mux-node | vite |
| @supabase/supabase-js | vite-plugin-pwa |
| livepeer, mammoth, stripe | |
| react, react-dom, react-router-dom | |

## Rutas (App.jsx:15-30)
| Ruta | Componente | Protección |
|------|------------|------------|
| `/` | Landing | Pública |
| `/auth` | Auth | Pública |
| `/plans` | Plans (lazy) | Requiere sesión |
| `/tour` | Tour (lazy) | Pública |
| `/manual` | Manual (lazy) | Pública |
| `/setup` | ProjectSetup (lazy) | Suscripción activa / admin |
| `/studio` | Studio (lazy) | Suscripción activa / admin |

**Auth flow**: `App.jsx:32-95` — hidratación de sesión, `localStorage` fallback, `onAuthStateChange`, carga de proyecto y suscripción.

## Variables de entorno (.env.example:1-37)
**Cliente (VITE_*)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`
**Servidor**: `SUPABASE_SERVICE_ROLE_KEY`, `MEAI_API_KEY`, `MEAI_MODEL`, `STRIPE_*`, `RESEND_*`, `SITE_URL`
**Opcional**: `MUX_*`, `GOOGLE_*`, `RESTREAM_*`, `LIVEPEER_*`

## APIs de desarrollo (vite.config.js)
Todas en `vite.config.js` (355 líneas) — **candidatas a mover a `api/`**:
- `/api/stripe/*` — status, session, checkout, subscription, sync, portal, webhook
- `/api/email/status`, `/api/email/send`
- `/api/ai/status`, `/api/ai` (POST)
- `/api/auth/login`

## PWA (vite.config.js:315-340)
- `registerType: 'autoUpdate'`
- Workbox: `navigateFallback: '/index.html'`, denylist `/api/`
- Icons: 192x192, 512x512 (maskable + any)
- Theme: `#e8612a`, bg `#08080b`, landscape, español

## Estructura lib/ (módulos server-side)
```
lib/
├── ai/claude.js           # callClaude()
├── email/resend.js        # sendNotificationEmail()
├── integrations/
├── livepeer/
├── mux/
├── restream/
├── stripe/
│   ├── client.js          # createCheckoutSession, retrieveCheckoutSession
│   ├── plans.js           # PLANS array
│   ├── subscriptions.js   # getSubscriptionByUserId, isActiveSubscription
│   ├── sync.js            # syncCheckoutSessionForUser
│   └── webhooks.js        # handleStripeWebhook
├── supabase/
│   ├── admin.js           # isSupabaseAdminConfigured
│   ├── auth.js            # getUserFromAuthHeader, mapSupabaseUser
│   └── serverLogin.js     # serverSignIn
└── youtube/
```

## Flujo de usuario (README.md)
1. Registro/login (`/auth`) → Supabase Auth
2. Tour (primera visita) → Planes (`/plans`) → Stripe Checkout
3. Setup (`/setup`) — wizard del episodio
4. Studio (`/studio`) — grabación multicámara

**Protección**: `/plans` = sesión; `/setup` + `/studio` = suscripción activa (excepto `app_metadata.role === 'admin'`)

## Funciones del Studio (README.md)
- Switcher 3 cámaras (USB, WiFi, móvil dual)
- Look Pro — presets, LUTs, viñeta, transiciones (límites por plan)
- Sets virtuales (preview + grabación)
- Cintillos animados + IA, teleprompter, música/SFX
- Director IA de cámaras (plan Pro)
- Grabación WebM/MP4 local
- Posts IA para redes (20/mes Starter, ilimitado Pro)
- Publicar: descarga local, Mux cloud, YouTube

## Base de datos (Supabase)
Tablas principales: `projects`, `subscriptions`, `recordings`
Schema: `supabase/schema.sql` (ejecutar en SQL Editor)
Admin: Dashboard → Auth → Users → App Metadata → `{"role": "admin"}`

## Archivos de configuración clave
| Archivo | Qué define |
|---------|------------|
| `vite.config.js` | Plugins, server, preview, APIs dev, PWA, define `__APP_BUILD__` |
| `package.json` | Deps, scripts, type: module |
| `.env.example` | 22 variables documentadas |
| `vercel.json` | (si existe) config deploy |
| `src/lib/supabase.js` | Cliente Supabase, helpers auth |
| `src/lib/billing.js` | fetchSubscription() |
| `src/lib/projects.js` | loadProject() |
| `src/components/ProtectedRoute.jsx` | Guard de rutas |

## Decisiones registradas
- Ninguna aún — usar `ROADMAP/DECISIONS.md` para futuras

## Próximas mejoras de tokens (pendientes)
1. Mover APIs dev a `api/` (serverless functions)
2. Dividir `vite.config.js` en plugins separados
3. Documentar decisiones en `ROADMAP/DECISIONS.md`
4. Tree-shaking agresivo para deps pesadas (FFmpeg, MediaPipe, Livepeer)