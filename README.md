# PodcastStudio 2.0 🎬

Estudio profesional de grabación multicámara con **Escenarios Virtuales 3D** — React 19, Vite 8, Three.js, Supabase. Producción: [podcastudio.mx](https://www.podcastudio.mx).

## ✨ Nuevo en v2.0: Escenarios Virtuales 3D

**El primer software de podcast con sets 3D profesionales en tiempo real:**
- 🎬 4 escenarios 3D con iluminación broadcast real
- 🌟 Parallax reactivo al movimiento del presentador
- 💡 Sombras dinámicas y post-processing profesional
- 🚀 Sin pantalla verde requerida (chroma key con IA)

**Escenarios disponibles:**
1. **Estudio de Noticias 3D** - Set broadcast completo
2. **Talk Show Cálido 3D** - Entrevista estilo late night
3. **Tech Keynote 3D** - Escenario futurista estilo Apple
4. **Escenario Musical 3D** - Stage de concierto profesional

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19, Vite 8, PWA |
| **3D Engine** | **Three.js r165, WebGL 2.0** |
| Auth / DB | Supabase (`projects`, `subscriptions`, `recordings`) |
| Pagos | Mercado Pago Checkout + webhooks |
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

**Servidor:** `SUPABASE_SERVICE_ROLE_KEY`, `MEAI_API_KEY`, `MERCADO_PAGO_*`, `RESEND_*`, `SITE_URL`

**Opcional:** `MUX_*`, `GOOGLE_*` (YouTube), `RESTREAM_*`, `LIVEPEER_*`

## Base de datos

Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase.

Para cuenta **admin** (acceso al estudio sin suscripción): Dashboard → Authentication → Users → App Metadata → `{"role": "admin"}`.

## Flujo de usuario

1. Registro / login (`/auth`) — Supabase Auth
2. Tour (primera visita) → Planes (`/plans`) — Mercado Pago
3. Setup (`/setup`) — wizard del episodio
4. Studio (`/studio`) — grabación multicámara

Rutas protegidas: `/plans` requiere sesión; `/setup` y `/studio` requieren suscripción activa (excepto admin).

## Funciones del estudio

### 🎬 Escenarios Virtuales 3D (NEW)
- 4 sets 3D profesionales con iluminación real
- Chroma key con IA (sin pantalla verde)
- Sombras dinámicas y parallax reactivo
- Post-processing: Bloom, SSAO, tone mapping

### 📹 Producción Multi-cámara
- Switcher 3 cámaras (USB, WiFi, móvil dual)
- Look Pro — presets, LUTs, viñeta, transiciones
- Sets virtuales 2D de estudio (legacy)
- Director IA de cámaras (plan Pro)

### 🎙️ Herramientas Profesionales
- Cintillos animados + IA generativa
- Teleprompter con carga de guiones
- Banco de música y efectos de sonido
- Grabación WebM/MP4 local (hasta 4K)

### 🤖 IA Integrada
- Posts para redes sociales (20/mes Starter, ilimitado Pro)
- Generación de guiones y cintillos
- Publicar: descarga local, Mux cloud, YouTube

## Build

```bash
npm run build
```
