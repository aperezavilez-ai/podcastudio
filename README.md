# PodcastStudio

Estudio profesional de grabación multicámara para podcasters — React 19, Vite 8, Supabase, Stripe, Claude API. Producción: [podcastudio.mx](https://www.podcastudio.mx).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19, Vite 8, PWA |
| Auth / DB | Supabase (`projects`, `subscriptions`, `recordings`) |
| Pagos | Stripe Checkout + webhooks |
| IA | Claude API (`/api/ai`) — cintillos, guiones, posts |
| Email | Resend (`/api/email/send`) |
| Cloud (opcional) | Mux upload, YouTube OAuth publish |
| Deploy | Vercel — push a `main` |

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre http://localhost:3000

## Variables de entorno

Copia `.env.example` → `.env.local` (local) y configura las mismas en Vercel (producción).

**Cliente (VITE_*):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`

**Servidor:** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*`, `RESEND_*`, `SITE_URL`

**Opcional:** `MUX_*`, `GOOGLE_*` (YouTube), `RESTREAM_*`, `LIVEPEER_*`

## Base de datos

Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase.

Para cuenta **admin** (acceso al estudio sin suscripción): Dashboard → Authentication → Users → App Metadata → `{"role": "admin"}`.

## Flujo de usuario

1. Registro / login (`/auth`) — Supabase Auth
2. Tour (primera visita) → Planes (`/plans`) — Stripe
3. Setup (`/setup`) — wizard del episodio
4. Studio (`/studio`) — grabación multicámara

Rutas protegidas: `/plans` requiere sesión; `/setup` y `/studio` requieren suscripción activa (excepto admin).

## Funciones del estudio

- Switcher 3 cámaras (USB, WiFi, móvil dual)
- Look Pro — presets, LUTs, viñeta, transiciones (límites por plan)
- Sets virtuales de estudio (preview + grabación)
- Cintillos animados + IA, teleprompter, música/SFX
- Director IA de cámaras (plan Pro)
- Grabación WebM/MP4 local
- Posts IA para redes (20/mes Starter, ilimitado Pro)
- Publicar: descarga local, Mux cloud, YouTube (si configurado)

## Build

```bash
npm run build
```
