# PodcastStudio

Plataforma profesional de grabación y transmisión en vivo para podcasters.

## Tecnologías
- React 19 + Vite 8
- WebRTC para acceso a cámaras y micrófono
- MediaRecorder API para grabación
- Claude API (claude-sonnet-4-6) para cintillos IA y posts virales
- React Router para navegación

## Instalación

```bash
npm install
npm run dev
```

- **Local:** http://localhost:3000
- **Producción (Vercel):** conectado al repo `aperezavilez-ai/podcastudio` — cada push a `main` despliega automáticamente.

## Estructura

```
src/
  pages/
    Landing.jsx       — Página de marketing
    Auth.jsx          — Login / registro
    ProjectSetup.jsx  — Wizard de configuración del episodio
    Studio.jsx        — Estudio principal de grabación
    Plans.jsx         — Planes de pago (Stripe — pendiente)
  components/
    CameraView.jsx    — Componente de vista de cámara real
    VUMeter.jsx       — Medidor de audio animado
    PostsPanel.jsx    — Panel de generación de posts con IA
  hooks/
    useWebcam.js      — WebRTC: detecta y controla cámaras/micrófono
    useRecorder.js    — Grabación con MediaRecorder
    useAI.js          — Llamadas a Claude API
```

## Funciones implementadas

- [x] Landing page profesional con canvas animado
- [x] Auth (login / registro)
- [x] Wizard de configuración de proyecto (4 pasos)
- [x] Detección real de cámaras USB vía WebRTC
- [x] Conexión de cámaras WiFi (MJPEG / video por URL)
- [x] Emparejamiento Bluetooth + activación de stream WiFi
- [x] Switcher de 3 cámaras en vivo
- [x] Logo del podcast en esquina seleccionable (9 posiciones)
- [x] Cintillos con animación (invitado, tema, promo, redes, custom)
- [x] Generación de cintillos con IA (Claude API)
- [x] Grabación en WebM (HD) con descarga
- [x] Transmisión en vivo simulada (Facebook, YouTube, TikTok, Instagram)
- [x] VU meter de audio en tiempo real
- [x] Música de fondo sin copyright (UI lista)
- [x] Posts virales con hashtags por IA para 4 plataformas
- [x] Formatos: 16:9, 9:16, 1:1
- [x] Contador de espectadores simulado cuando en vivo

## Dependencias externas pendientes de conectar

### 1. Pagos — Stripe
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```
Crear cuenta en stripe.com, obtener claves públicas/privadas.
Agregar backend (Node.js/Supabase Edge Functions) para crear PaymentIntents.

### 2. Base de datos / Auth — Supabase
```bash
npm install @supabase/supabase-js
```
Crear proyecto en supabase.com.
Reemplazar la auth simulada en Auth.jsx con supabase.auth.signInWithPassword() / signUp().
Guardar proyectos y configuraciones del usuario en tabla `projects`.

### 3. Streaming en vivo real — RTMP
Para transmisión real a YouTube/Facebook/TikTok se necesita:
- Servidor backend con Node.js + ffmpeg
- Módulo node-media-server o similar
- O usar un servicio como Mux (mux.com) o LivePeer
El navegador envía el stream vía WebRTC al servidor, que lo reenvía por RTMP a cada plataforma.

### 4. Música sin copyright
Integrar API de:
- Pixabay Audio API (gratuita): https://pixabay.com/api/docs/
- Jamendo API: https://developer.jamendo.com/

### 5. Claude API — Clave real
En src/hooks/useAI.js la CLAUDE_API ya apunta a la URL correcta.
El navegador necesita una clave de API. Para producción usar un proxy/backend para no exponer la clave.
Obtener clave en: https://console.anthropic.com/

## Producción (Vercel)

El proyecto incluye `vercel.json` con rewrites para React Router (rutas como `/studio`, `/auth`, etc.).

### Variables de entorno en Vercel

En **Project Settings → Environment Variables**:

| Variable | Uso |
|----------|-----|
| `VITE_SITE_URL` | URL pública con tu dominio propio (ej. `https://podcastudio.tudominio.com`) |
| `VITE_ANTHROPIC_API_KEY` | Clave Claude (recomendado: proxy backend, no exponer en frontend) |

### Build local

```bash
npm run build
npm run preview
```

El output en `/dist` se sirve automáticamente en Vercel tras cada push a `main`.
