# Rotación de Claves de Seguridad - PODCASTUDIO

## 🔴 ACCIÓN INMEDIATA REQUERIDA

Este documento te guía para rotar todas las claves que fueron identificadas en el análisis de seguridad.

---

## 1. Supabase Service Role Key

### Por qué rotar
Las claves actuales son de `supabase-demo` (tokens públicos por defecto).

### Cómo rotar

#### Opción A: Supabase Cloud (Recomendado)
1. Ir a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto PODCASTUDIO
3. Ir a **Settings** → **API**
4. En la sección **Project API keys**, copiar:
   - `anon` public key
   - `service_role` secret key (⚠️ Mantener SECRETA)
5. Actualizar en `.env.local`:
```bash
VITE_SUPABASE_ANON_KEY=eyJ... # Nueva anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Nueva service_role key
```

#### Opción B: Supabase Self-Hosted GAFCORE
1. Conectar a la instancia en `https://api-podcastudio.gafcore.com`
2. Regenerar JWT tokens con nuevo secreto:
```bash
# En el servidor de Supabase
docker exec -it supabase_auth supabase db reset
# O manualmente con nuevo JWT_SECRET en .env
```

### Impacto
- **Alta prioridad**
- Requiere redeploy en Vercel con nuevas variables
- Todas las sesiones activas se invalidarán

---

## 2. Vercel OIDC Token

### Por qué rotar
Token de deployment expuesto en `.env.local`.

### Cómo rotar

1. Ir a [Vercel Dashboard](https://vercel.com/dashboard)
2. Navegar a **Settings** → **Tokens**
3. Encontrar el token actual y hacer clic en **Delete**
4. Crear nuevo token:
   - Nombre: `PODCASTUDIO_DEPLOY`
   - Scope: Tu cuenta/organización
   - Expiration: 90 días (recomendado)
5. Copiar el nuevo token
6. **NO agregarlo a `.env.local`** (solo úsalo en CI/CD si es necesario)
7. Si usas GitHub Actions, actualizar en **Repository Secrets**

### Impacto
- **Alta prioridad**
- No afecta el sitio en producción
- Solo afecta deployments automáticos

---

## 3. Resend API Key

### Por qué rotar
API key expuesta en `.env.local`.

### Cómo rotar

1. Ir a [Resend Dashboard](https://resend.com/api-keys)
2. Encontrar la key actual: `re_Ca7X56sF_DBtwHQiU9GZJRs8McwjMoq6d`
3. Hacer clic en **Delete** o **Revoke**
4. Crear nueva API key:
   - Nombre: `PodcastStudio Production`
   - Permissions: **Full Access** (o solo **Sending Access** si prefieres)
5. Copiar la nueva key
6. Actualizar en `.env.local`:
```bash
RESEND_API_KEY=re_... # Nueva key
```
7. Actualizar en Vercel:
   - Ir a tu proyecto → **Settings** → **Environment Variables**
   - Editar `RESEND_API_KEY` con el nuevo valor
   - Redeploy

### Impacto
- **Media prioridad**
- Afecta envío de emails de notificaciones
- Sin emails hasta que se actualice

---

## 4. Mercado Pago Access Token

### Por qué rotar
Buena práctica rotar periódicamente tokens de pago.

### Cómo rotar

1. Ir a [Mercado Pago Developers](https://www.mercadopago.com.mx/developers/panel)
2. Seleccionar tu aplicación PODCASTUDIO
3. Ir a **Credenciales** → **Credenciales de producción**
4. Hacer clic en **Regenerar Access Token**
5. Copiar el nuevo token
6. Actualizar en `.env.local`:
```bash
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-... # Nuevo token
```
7. Actualizar en Vercel:
   - Proyecto → **Settings** → **Environment Variables**
   - Editar `MERCADO_PAGO_ACCESS_TOKEN`
   - Redeploy

### Impacto
- **Alta prioridad**
- Afecta checkout y procesamiento de pagos
- Sin pagos hasta que se actualice

---

## 5. Mercado Pago Webhook Secret

### Por qué configurar
Actualmente NO está configurado (webhook sin validación).

### Cómo configurar

1. Generar secreto aleatorio fuerte:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# O usar generador online: https://randomkeygen.com/
```

2. Agregar a `.env.local`:
```bash
MERCADO_PAGO_WEBHOOK_SECRET=tu_secreto_generado_aqui
```

3. Agregar en Vercel:
   - Proyecto → **Settings** → **Environment Variables**
   - Agregar nueva variable `MERCADO_PAGO_WEBHOOK_SECRET`
   - Redeploy

4. Configurar en Mercado Pago:
   - Panel Developers → Tu app → **Webhooks**
   - URL: `https://www.podcastudio.mx/api/mercadopago/webhook`
   - En "Secret" pegar el mismo secreto generado

### Impacto
- **CRÍTICO**
- Previene fraude en webhooks
- La validación ya está implementada en el código

---

## 6. Google OAuth Credentials

### Por qué revisar
Revisar si están expuestas públicamente.

### Cómo rotar

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Navegar a **APIs & Services** → **Credentials**
3. Encontrar el OAuth 2.0 Client ID actual
4. Eliminar y crear nuevo:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `https://www.podcastudio.mx/api/youtube/callback`
     - `http://localhost:3000/api/youtube/callback` (desarrollo)
5. Copiar nuevo Client ID y Client Secret
6. Actualizar en `.env.local`:
```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```
7. Actualizar en Vercel

### Impacto
- **Media prioridad**
- Afecta publicación en YouTube
- Usuarios necesitarán reconectar su canal

---

## 7. Mux Tokens (Opcional)

### Cómo rotar

1. Ir a [Mux Dashboard](https://dashboard.mux.com/)
2. Navegar a **Settings** → **Access Tokens**
3. Revocar token actual y crear nuevo
4. Actualizar en `.env.local` y Vercel:
```bash
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...
```

---

## Checklist de Rotación

Completa esta lista en orden de prioridad:

- [ ] 1. **Mercado Pago Webhook Secret** (configurar NUEVO)
- [ ] 2. **Mercado Pago Access Token** (rotar)
- [ ] 3. **Supabase Service Role Key** (rotar)
- [ ] 4. **Resend API Key** (rotar)
- [ ] 5. **Vercel OIDC Token** (rotar)
- [ ] 6. **Google OAuth Credentials** (revisar y rotar si es necesario)
- [ ] 7. **Mux Tokens** (opcional, rotar si tienes tiempo)

---

## Después de Rotar

### 1. Actualizar Vercel Environment Variables

```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Login
vercel login

# Actualizar variables (una por una)
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add RESEND_API_KEY production
vercel env add MERCADO_PAGO_ACCESS_TOKEN production
vercel env add MERCADO_PAGO_WEBHOOK_SECRET production

# O editar desde el dashboard: https://vercel.com/dashboard
```

### 2. Redeploy

```bash
vercel --prod
```

O desde el dashboard: **Deployments** → **Redeploy**

### 3. Verificar

1. Probar login: ✅
2. Probar checkout de Mercado Pago: ✅
3. Probar envío de email: ✅
4. Probar webhook (hacer pago de prueba): ✅

---

## Prevención Futura

### 1. Verificar .gitignore

```bash
cd "D:\PROGRAMAS IA\PODCASTUDIO"
cat .gitignore | grep .env
```

Debe contener:
```
.env
.env.local
.env.*.local
```

### 2. Pre-commit Hook

Agregar hook para prevenir commit de secretos:

```bash
# Instalar gitleaks
npm install -g gitleaks

# Crear hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
gitleaks protect --staged --verbose
EOF

chmod +x .git/hooks/pre-commit
```

### 3. Rotación Programada

Configurar recordatorio para rotar cada 90 días:

- Supabase keys: cada 90 días
- Mercado Pago: cada 90 días
- Resend: cada 6 meses
- Google OAuth: cada 6 meses

---

## Soporte

Si tienes dudas sobre la rotación:

1. **Supabase**: https://supabase.com/docs/guides/api
2. **Mercado Pago**: https://www.mercadopago.com.mx/developers/es/support
3. **Resend**: https://resend.com/docs
4. **Vercel**: https://vercel.com/docs/concepts/projects/environment-variables

---

**Última actualización**: 2025-01-14
**Prioridad**: 🔴 CRÍTICA - Ejecutar en las próximas 24 horas
