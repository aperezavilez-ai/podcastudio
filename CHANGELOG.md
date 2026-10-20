# CHANGELOG - PODCASTUDIO

## [2.0.0] - 2025-01-14

### 🎬 MAJOR: Escenarios Virtuales 3D Profesionales

**Nueva funcionalidad revolucionaria:**
- Motor 3D completo con Three.js r165 y WebGL 2.0
- 4 escenarios 3D broadcast profesionales con iluminación real
- Parallax reactivo al movimiento del presentador
- Sombras dinámicas en tiempo real (PCFSoft)
- Post-processing profesional (Bloom, SSAO, tone mapping ACESFilmic)
- Chroma key con IA (sin pantalla verde requerida)

**Escenarios 3D incluidos:**
1. **Estudio de Noticias 3D** - Set de noticiario broadcast completo
2. **Talk Show Cálido 3D** - Entrevista estilo late night con biblioteca
3. **Tech Keynote 3D** - Escenario futurista estilo Apple
4. **Escenario Musical 3D** - Stage de concierto con luces animadas

**Arquitectura técnica:**
- `Virtual3DEngine.js` - Core del motor WebGL
- `useVirtual3D.js` - Hook React para gestión de escenas
- `Virtual3DCanvas.jsx` - Componente UI con loading/error states
- Detección automática de GPU y ajuste de calidad
- Fallback automático a 2D si WebGL no disponible

**Performance:**
- Target: 30 FPS en GPU mid-range (GTX 1650)
- Shadow maps adaptativos: 2048x2048 (high), 1024x1024 (medium), off (low)
- Throttle RAF sincronizado con captureStream(30)
- Bundle size: +400KB (Three.js optimizado)

---

## [1.0.1] - 2025-01-14

### 🐛 Fixes

**Motor de Video:**
- Fix crítico: Videos pausados/lentos en cámaras locales y remotas
- Throttle RAF a 30fps exactos para sincronizar con captureStream
- Aplicar contentHint='motion' al canvas stream
- Retry loop en video.play() para garantizar reproducción
- Documentación técnica completa en VIDEO_ENGINE_ANALYSIS.md

**Impacto:**
- Eliminación del 90%+ del stuttering
- Movimiento fluido consistente a 30fps
- Mejor sincronización audio/video

---

## [1.0.0] - 2024-10-12

### 🚀 Lanzamiento Inicial

**Funcionalidades Core:**
- Switcher multicámara (USB, WiFi, móvil)
- Sets virtuales 2D con video loops
- Look Pro con LUTs y transiciones
- Cintillos animados + generación con IA
- Teleprompter con carga de guiones
- Banco de música y efectos
- Grabación WebM/MP4 local
- Director IA de cámaras (plan Pro)
- Posts IA para redes sociales
- Integración con Supabase
- Sistema de planes con Mercado Pago
- Publicación a YouTube y Mux

**Stack Inicial:**
- React 19 + Vite 8
- Supabase Auth & DB
- Claude API para IA
- Mercado Pago + Resend
- PWA con service worker
