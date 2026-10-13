# core:.env.example

Fecha de ingesta: 2026-10-13T15:03:58.062Z
Fuente: D:\PROGRAMAS IA\PODCASTUDIO\.env.example
Tags: core, auto-ingest

# Copia este archivo a .env.local y pega tus claves reales.
# .env.local NO se sube a GitHub (está en .gitignore).

# Resend — solo servidor
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=PodcastStudio <notificaciones@podcaststudio.mx>

# Mercado Pago — solo servidor
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
MERCADO_PAGO_WEBHOOK_SECRET=...
SITE_URL=https://www.podcastudio.mx
VITE_SITE_URL=https://www.podcastudio.mx

# Supabase — también en Vercel (redeploy tras cambiar)
VITE_SUPABASE_URL=https://fzoiuyyvzhgqcjceagkd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Mux — subida opcional de grabaciones (VOD / YouTube)
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...

# YouTube OAuth — publicar grabación en tu canal (opcional)
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

# Restream / Livepeer — solo si en el futuro activas transmisión en vivo
# RESTREAM_API_TOKEN=...
# LIVEPEER_API_KEY=...

