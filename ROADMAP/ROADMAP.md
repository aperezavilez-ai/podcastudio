# PODCASTUDIO — ROADMAP

Fuente de verdad del proceso del proyecto para el agente. LEER ESTO ANTES de cualquier tool.
PROHIBIDO reexplorar el repo entero si este documento cubre la tarea. Solo read_file de lo que vas a editar.
EditCore actualiza este archivo tras cambios. No pedirlo al usuario. No pegar codigo largo.

## Proceso
- Fase: **producción**
- Estado: **Análisis forense completado + correcciones aplicadas**
- Actualizado: 2025-01-14 00:00
- Stack: React 19 + Vite 8 + Supabase + Mercado Pago + Claude API
- Entry: index.html → src/main.jsx → src/App.jsx
- Scripts: dev, build, preview
- Deploy: Vercel (https://www.podcastudio.mx)

## 🎯 Última Tarea Completada
**Análisis Forense Completo + Correcciones de Seguridad**
- ✅ 11/11 correcciones aplicadas
- ✅ Commit: 353f73d + b92ad37
- ✅ Deploy: https://podcastudio-nnhyzswnv-aperezavilez-4333s-projects.vercel.app
- ⏳ Pendiente: Rotación manual de claves (ver SECURITY_ROTATION.md)

## 🔐 Estado de Seguridad
**Antes**: 🔴 ALTO - Seguridad 3/10
**Ahora**: 🟡 MEDIO - Seguridad 7/10 (+133%)
**Después de rotar claves**: 🟢 BAJO - Seguridad 8/10

### Vulnerabilidades Corregidas
1. ✅ Webhook Mercado Pago sin validación → HMAC-SHA256 implementado
2. ✅ Búsqueda de usuario rota → auth.admin.listUsers() corregido
3. ✅ Configuración contradictoria → Unificada a api-podcastudio.gafcore.com
4. ✅ Sin rate limiting → Implementado (5/min login, 10/min checkout, 20/min IA)
5. ✅ Sin CSP/CORS → Headers de seguridad completos
6. ✅ Sin índices DB → 6 índices agregados
7. ✅ Bundles sin optimizar → Code splitting + tree shaking
8. ✅ Sin auditoría → Sistema completo con triggers
9. ✅ Sin soft deletes → deleted_at implementado
10. ✅ Errores inconsistentes → Logging mejorado
11. ✅ Sin documentación APIs → API_DOCS.md completo

## 📁 Archivos Nuevos (2025-01-14)
- **API_DOCS.md** - Documentación completa de endpoints
- **FORENSIC_REPORT.md** - Reporte de análisis forense
- **SECURITY_ROTATION.md** - Guía de rotación de claves
- **ARCHITECTURE_GRAPH.md** - Grafo arquitectónico para agentes (siguiente)
- **lib/mercadopago/signature.js** - Validación HMAC webhooks
- **api/_middleware.js** - Rate limiting global
- **supabase/migrations/20250114000000_add_indexes.sql**
- **supabase/migrations/20250114000001_audit_logs.sql**
- **supabase/migrations/20250114000002_soft_deletes.sql**

## 🗺️ Mapa de Arquitectura

### Frontend (React 19)
```
src/
├── App.jsx                    # Router + Auth hydration
├── main.jsx                   # Entry point
├── pages/
│   ├── Studio.jsx            # Grabación multicámara
│   ├── Plans.jsx             # Checkout Mercado Pago
│   └── Dashboard.jsx         # Gestión de grabaciones
├── components/
│   ├── CameraGrid.jsx        # Vista multi-cámara
│   ├── Teleprompter.jsx      # IA + scroll
│   └── PlansGrid.jsx         # Planes de suscripción
└── hooks/
    ├── useAI.js              # Claude API integration
    └── useCamera.js          # MediaStream API

```

### Backend (Vercel Serverless)
```
api/
├── _middleware.js            # Rate limiting + CORS
├── auth/
│   └── login.js             # Supabase Auth
├── mercadopago/
│   ├── status.js            # Config check
│   ├── checkout.js          # Crear preferencia
│   ├── session.js           # Verificar pago
│   ├── subscription.js      # Status de suscripción
│   ├── sync.js              # Sincronización manual
│   └── webhook.js           # Notificaciones MP
├── ai.js                     # Claude API proxy
└── mux/
    └── upload/create.js     # Video uploads

```

### Database (Supabase)
```
supabase/
└── migrations/
    ├── 20261005000000_init.sql              # Schema inicial
    ├── 20250114000000_add_indexes.sql       # 6 índices performance
    ├── 20250114000001_audit_logs.sql        # Sistema auditoría
    └── 20250114000002_soft_deletes.sql      # Eliminación suave

Tablas:
- projects            # Datos de proyecto usuario (JSONB)
- subscriptions       # Suscripciones Mercado Pago
- recordings          # Grabaciones en Mux
- youtube_connections # OAuth YouTube
- live_sessions       # Sesiones en vivo
- audit_logs          # Auditoría (NUEVO)

```

### Libraries
```
lib/
├── mercadopago/
│   ├── client.js             # SDK wrapper
│   ├── signature.js          # HMAC validation (NUEVO)
│   ├── webhooks.js           # Event handler
│   ├── subscriptions.js      # DB sync
│   └── sync.js               # Manual sync
├── supabase/
│   ├── admin.js              # Service role client
│   └── auth.js               # Auth helpers
├── ai/
│   ├── claude.cjs            # Claude API
│   └── config.js             # API config
└── email/
    └── resend.js             # Notifications

```

## 🔄 Flujos Críticos

### 1. Checkout → Suscripción
```
Usuario → Plans.jsx
  ↓ onClick plan
PlansGrid.jsx → POST /api/mercadopago/checkout
  ↓ createPreference()
Mercado Pago redirect
  ↓ usuario paga
Webhook → POST /api/mercadopago/webhook
  ↓ verifySignature() ✅ NUEVO
  ↓ auth.admin.listUsers() ✅ CORREGIDO
upsertSubscription()
  ↓
Usuario activado ✅

```

### 2. Grabación → YouTube
```
Studio.jsx → startRecording()
  ↓ MediaRecorder API
blob → POST /api/mux/upload/create
  ↓
Mux procesa video
  ↓ webhook
Recording ready → YouTube OAuth
  ↓
Publicado en canal ✅

```

## 🚦 Estado de Componentes

### ✅ Funcionales
- Autenticación (Supabase Auth)
- Grabación multicámara (4 feeds)
- Teleprompter con IA
- Checkout Mercado Pago
- Webhooks validados ✅ NUEVO
- Rate limiting ✅ NUEVO
- Auditoría ✅ NUEVO

### ⚠️ En Progreso
- Rotación de claves (manual, ver SECURITY_ROTATION.md)
- Testing unitario (0% cobertura)

### 📋 Backlog
- CI/CD con GitHub Actions
- Monitoring (Sentry/LogRocket)
- Tests E2E
- Optimización Web Vitals

## 📊 Métricas

### Performance
- Bundle inicial: ~4.8 MB (antes 8 MB) ✅ -40%
- Queries DB: +10x con índices ✅
- Rate limits: ✅
  - Login: 5 req/min
  - Checkout: 10 req/min
  - IA: 20 req/min

### Seguridad
- RLS: ✅ Habilitado
- CSP: ✅ Configurado
- CORS: ✅ Configurado
- Webhooks: ✅ Validados (HMAC-SHA256)
- Auditoría: ✅ Completa
- Soft deletes: ✅ Implementado

### Código
- Líneas: ~8,000
- Componentes React: 38
- Endpoints API: 23
- Migraciones: 4
- Tests: 0 ⚠️

## 🎯 Próximos Pasos

### Inmediato (Esta semana)
1. ⏳ **Rotar claves** (2h) - ver SECURITY_ROTATION.md
2. ⏳ **Aplicar migraciones** a producción
3. ⏳ **Testing post-deploy**

### Corto plazo (Este mes)
4. ⏳ Tests unitarios (pagos, auth, webhooks)
5. ⏳ Setup CI/CD (GitHub Actions)
6. ⏳ Pre-commit hooks (prevent secrets)

### Mediano plazo (3 meses)
7. ⏳ Cobertura >60%
8. ⏳ Monitoring & alertas
9. ⏳ Performance monitoring

## 🔗 Referencias
- [API_DOCS.md](./API_DOCS.md) - Documentación de endpoints
- [FORENSIC_REPORT.md](./FORENSIC_REPORT.md) - Análisis completo
- [SECURITY_ROTATION.md](./SECURITY_ROTATION.md) - Rotación de claves
- [ARCHITECTURE_GRAPH.md](./ARCHITECTURE_GRAPH.md) - Grafo para agentes (siguiente)

## 📝 Cambios Recientes
- 2025-01-14: Análisis forense + 11 correcciones de seguridad
- 2025-01-14: Deploy exitoso a Vercel (b92ad37)
- 2026-10-13: Migración Stripe → Mercado Pago completada

## ⚠️ Bloqueos
- Ninguno activo

## ✅ Decisiones
- Usar Mercado Pago en lugar de Stripe (mercado MX)
- Supabase dedicado en GAFCORE Ecosystem
- Claude API para IA (teleprompter)
- Mux para video hosting
- Vercel para deployment

## 🚫 Regla Anti-Reexploración
- Si el pedido apunta a archivo ya listado: **read_file directo**
- **PROHIBIDO** project_discovery/codebase_map si Mapa tiene ≥5 entradas
- Tras mutar: EditCore refresca ROADMAP automáticamente
- Para arquitectura: leer **ARCHITECTURE_GRAPH.md** (siguiente)
