# PODCASTUDIO - Roadmap de Desarrollo y Lanzamientos

## Versión Actual: v1.0.1 (Octubre 2026)

### 🚀 Novedades de la Versión v1.0.1
* **Motor de Escenarios Virtuales 3D Profesionales (Three.js WebGL 2.0):**
  * Iluminación de estudio broadcast real (Key Light, Fill Light, Rim Light y Ambient Light).
  * Sombras dinámicas en tiempo real (*PCFSoftShadowMap* 2048x2048 con detección de GPU tier).
  * Renderizado del presentador como *VideoTexture* en perspectiva 3D dentro del set con profundidad real.
  * Suelo de estudio PBR reflectivo con acabado metálico o madera acústica.
  * Tarima circular iluminada con bordes LED y videowall curvo 3D con emisión de luz.
  * Generador procedural broadcast integrado como fallback inteligente (0ms de latencia, 0% fallas de red).
* **Catálogo de Escenarios 3D:**
  1. `news-3d` - Estudio de Noticias 3D Profesional
  2. `interview-3d` - Talk Show Cálido 3D
  3. `tech-3d` - Tech Keynote 3D Futurista
  4. `concert-3d` - Escenario Musical 3D
* **Optimización de Fluidez Zero-Latency (30/60 FPS):**
  * Reemplazo del canvas 2D limitado a 12 FPS por elementos `<video>` acelerados directamente por GPU en el switcher y miniaturas.
  * Parche SDP WebRTC `b=AS:3500` y bitrate mínimo forzado (`1.2 Mbps` - `3.5 Mbps`) con `degradationPreference: maintain-framerate` para evitar pausas en tomas estáticas de celulares y cámaras Wi-Fi.
  * STUN Anycast ultrarrápido con Cloudflare y Google (<100ms de handshake ICE).
* **Sincronización de Audio & Lip-Sync Milimétrico:**
  * Mezclador de audio integrado (`useAudioMix`) acoplado a 48 kHz con ajuste de compensación de latencia (`setAudioSyncDelay`).
* **Exportación y Descarga Multi-Formato:**
  * Generación y descarga directa en 4 formatos para redes sociales: YouTube (16:9), Facebook (16:9), TikTok / Reels (9:16) con Auto-Framing / Blur-Fill, e Instagram Feed (1:1).
  * Extracción automática de miniaturas para cada red.

---

### 🗺️ Roadmap de Próximos Sprints (v1.1.0 - v2.0.0)

#### Sprint 3: Parallax Reactivo y Tracking Facial / Corporal
- [ ] Integración con MediaPipe Pose Landmarker para mover la cámara virtual 3D según los movimientos del presentador.
- [ ] Detección de hombros y centro de gravedad para parallax orgánico a 60 FPS.

#### Sprint 4: Post-Processing Avanzado
- [ ] UnrealBloomPass para brillo de pantallas LED y fuentes de luz.
- [ ] SSAO (Screen Space Ambient Occlusion) para mayor contacto y sombras en esquinas y suelo.
- [ ] Color Grading y LUTs broadcast en tiempo real dentro del pipeline WebGL.

#### Sprint 5: Modelos GLTF Personalizables e Importador de Usuario
- [ ] Soporte para que los creadores suban sus propios sets 3D en formato `.glb` comprimido con Draco.
- [ ] Controles de color de luces y texto de los videowalls en vivo.
