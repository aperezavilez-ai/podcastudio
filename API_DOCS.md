# PODCASTUDIO - Documentación de APIs

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Mercado Pago](#mercado-pago)
3. [Email](#email)
4. [IA](#ia)
5. [Rate Limiting](#rate-limiting)
6. [Códigos de Error](#códigos-de-error)

---

## Autenticación

### POST /api/auth/login

Inicia sesión con email y contraseña.

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "contraseña123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_at": 1234567890,
  "user": {
    "id": "uuid",
    "email": "usuario@example.com",
    "role": "user"
  }
}
```

**Errores:**
- `401` - Credenciales inválidas
- `429` - Límite de intentos excedido (5/min)
- `500` - Error del servidor

---

## Mercado Pago

### GET /api/mercadopago/status

Verifica si Mercado Pago está configurado.

**Response 200:**
```json
{
  "configured": true,
  "webhook": true,
  "supabaseSync": true,
  "provider": "mercadopago",
  "currency": "MXN",
  "plans": [
    {
      "id": "creator",
      "name": "Creator",
      "price": 499,
      "interval": "month",
      "billed": "Mensual"
    }
  ]
}
```

---

### POST /api/mercadopago/checkout

Crea una preferencia de pago.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "planId": "creator",
  "email": "usuario@example.com",
  "userId": "uuid"
}
```

**Response 200:**
```json
{
  "url": "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=...",
  "preferenceId": "1234567-abcd1234-abcd-1234-abcd-1234567890ab"
}
```

**Errores:**
- `401` - No autorizado
- `429` - Límite excedido (10/min)
- `500` - Error creando preferencia

---

### GET /api/mercadopago/subscription

Obtiene la suscripción del usuario autenticado.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "planId": "creator",
  "status": "approved",
  "active": true,
  "currentPeriodEnd": "2025-02-14T00:00:00Z",
  "hasMPPreference": true
}
```

---

### POST /api/mercadopago/sync

Sincroniza un pago manualmente.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "paymentId": "1234567890"
}
```

**Response 200:**
```json
{
  "type": "payment_approved",
  "planId": "creator",
  "activated": true
}
```

---

### POST /api/mercadopago/webhook

Webhook para notificaciones de Mercado Pago.

**Headers:**
```
X-Signature: {signature}
Content-Type: application/json
```

**Request:**
```json
{
  "type": "payment",
  "data": {
    "id": "1234567890"
  }
}
```

**Response 200:**
```json
{
  "received": true,
  "type": "payment_approved"
}
```

**Tipos de respuesta:**
- `payment_approved` - Pago aprobado y suscripción activada
- `payment_not_approved` - Pago pendiente/rechazado
- `no_plan` - Pago sin plan asociado
- `no_payer` - Sin email del pagador
- `user_not_found` - Usuario no encontrado
- `ignored` - Evento ignorado

---

## Email

### GET /api/email/status

Verifica configuración de email.

**Response 200:**
```json
{
  "configured": true,
  "from": "PodcastStudio <notificaciones@podcastudio.mx>",
  "provider": "resend",
  "types": ["welcome", "project_ready", "recording_ready", "live_started"]
}
```

---

### POST /api/email/send

Envía notificación por email.

**Request:**
```json
{
  "type": "welcome",
  "to": "usuario@example.com",
  "data": {
    "name": "Usuario"
  }
}
```

**Response 200:**
```json
{
  "ok": true,
  "id": "re_..."
}
```

**Tipos de email:**
- `welcome` - Bienvenida al registrarse
- `project_ready` - Proyecto listo para grabar
- `recording_ready` - Grabación procesada
- `live_started` - Sesión en vivo iniciada

---

## IA

### GET /api/ai/status

Verifica configuración de IA.

**Response 200:**
```json
{
  "configured": true,
  "provider": "meai",
  "model": "claude-haiku-4-5"
}
```

---

### POST /api/ai

Genera contenido con IA.

**Request:**
```json
{
  "prompt": "Escribe una descripción para un podcast sobre tecnología",
  "systemPrompt": "Eres un experto en marketing de podcasts"
}
```

**Response 200:**
```json
{
  "text": "Tu podcast de tecnología..."
}
```

**Errores:**
- `429` - Límite excedido (20/min)
- `503` - IA no configurada
- `500` - Error generando contenido

---

## Rate Limiting

Todos los endpoints tienen rate limiting.

**Headers de respuesta:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 2025-01-14T12:00:00Z
```

**Límites por endpoint:**

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `/api/auth/login` | 5 req | 1 min |
| `/api/mercadopago/checkout` | 10 req | 1 min |
| `/api/mercadopago/webhook` | 100 req | 1 min |
| `/api/ai/*` | 20 req | 1 min |
| Otros endpoints | 60 req | 1 min |

**Error 429:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## Códigos de Error

### 400 - Bad Request
Solicitud mal formada o parámetros inválidos.

### 401 - Unauthorized
Token de autenticación faltante o inválido.

### 403 - Forbidden
No tienes permisos para este recurso.

### 404 - Not Found
Endpoint no existe.

### 405 - Method Not Allowed
Método HTTP no permitido.

### 429 - Too Many Requests
Límite de rate limiting excedido.

### 500 - Internal Server Error
Error interno del servidor.

### 503 - Service Unavailable
Servicio externo no configurado o no disponible.

---

## CORS

**Orígenes permitidos:**
- `https://www.podcastudio.mx`
- `https://podcastudio.mx`
- `http://localhost:3000` (desarrollo)

**Métodos permitidos:**
- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

**Headers permitidos:**
- `Content-Type`
- `Authorization`
- `X-Requested-With`

---

## Webhooks

### Seguridad

Todos los webhooks deben validar:

1. **Firma HMAC**: Verificar header `X-Signature` con secreto compartido
2. **IP Whitelist**: Validar que venga de IPs conocidas
3. **Replay Protection**: Verificar timestamp y rechazar eventos antiguos

### Mercado Pago Webhook

**URL**: `https://www.podcastudio.mx/api/mercadopago/webhook`

**Método**: `POST`

**Configurar en**: Panel de Mercado Pago → Webhooks → Agregar URL

**Eventos que procesa**:
- `payment.created`
- `payment.updated`

---

## Ambientes

### Desarrollo
- **URL**: `http://localhost:3000`
- **Supabase**: `https://api-podcastudio.gafcore.com` (local)

### Producción
- **URL**: `https://www.podcastudio.mx`
- **Supabase**: `https://api-podcastudio.gafcore.com`

---

## Autenticación con Supabase

Todas las APIs protegidas requieren token JWT de Supabase:

```javascript
const { data: { session } } = await supabase.auth.getSession()
const token = session.access_token

fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

---

## Changelog

- **2025-01-14**: Documentación inicial
  - Endpoints de Auth, Mercado Pago, Email, IA
  - Rate limiting implementado
  - CORS configurado
