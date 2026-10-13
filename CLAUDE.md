# PODCASTUDIO - Configuración de Infraestructura

## ⚠️ CONFIGURACIÓN DE SUPABASE

Este proyecto usa una **instancia dedicada de Supabase en GAFCORE Ecosystem**.

* **Supabase URL:** `https://api-podcastudio.gafcore.com`
* **Instance ID:** `podcastudio`
* **Schema:** `public`
* **Local API Port:** `58821`
* **Local DB Port:** `58822`

### Variables de Entorno Requeridas

Copiar `.env.example` a `.env.local` y completar:

```bash
# Supabase - Instancia dedicada PODCASTUDIO
VITE_SUPABASE_URL=https://api-podcastudio.gafcore.com
VITE_SUPABASE_ANON_KEY=<ANON_KEY de esta instancia>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY de esta instancia>
```

### Project Structure:
1. Migraciones SQL en `supabase/migrations/`
2. Schema dedicado: `public`
3. Aplicar migraciones con: `npm run db:migrate`
