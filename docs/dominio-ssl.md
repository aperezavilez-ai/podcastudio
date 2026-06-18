# DNS y HTTPS — podcastudio.mx

Dominio en Vercel: **podcastudio.mx** → redirige a **www.podcastudio.mx** (producción).

> ⚠️ No confundir con `podcaststudio.mx` (con «s»): ese dominio **no existe** y causa errores DNS/SSL.

## URL pública

**https://www.podcastudio.mx**

## Variables en Vercel

```env
SITE_URL=https://www.podcastudio.mx
VITE_SITE_URL=https://www.podcastudio.mx
```

Redeploy tras cambiarlas.

## Supabase → Authentication → URL Configuration

- **Site URL:** `https://www.podcastudio.mx`
- **Redirect URLs:** `https://www.podcastudio.mx/**` y `http://localhost:3000/**`
