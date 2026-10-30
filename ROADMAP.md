# 🗺️ ROADMAP OFICIAL — PODCASTSTUDIO

Documento maestro de desarrollo, hitos alcanzados y próximas fases del estudio broadcast.

---

## 🚀 Versión Actual: v1.2.7 (TURN administrado para cámaras móviles)
- **Relay TURN administrado**:
  - `/api/turn-credentials` genera credenciales temporales de 12 horas con Cloudflare Realtime TURN; las llaves permanecen en el servidor.
  - Se excluyen las URLs alternas del puerto 53, que pueden demorarse o estar bloqueadas en navegadores.
  - Configuración mediante `CLOUDFLARE_TURN_KEY_ID` y `CLOUDFLARE_TURN_API_TOKEN` en Vercel.
  - Cloudflare publica 1,000 GB mensuales de salida sin cargo y USD 0.05/GB después de ese límite.
- **Build y cierre**:
  - `PodcastStudio.exe` y pie de aplicación sincronizados a v1.2.7 / v1.2.7.0.

## 📦 Versión Previa: v1.2.6 (Cámaras móviles remotas y negociación WebRTC)
- **Video remoto Android/iOS**:
  - El estudio espera a que la pista de video reciba cuadros antes de asignar la cámara a una ranura, evitando presentar una pista todavía silenciada como video activo.
  - Se corrigió la actualización de parámetros de envío de video en `RTCRtpSendParameters`.
  - La configuración ICE deja de incluir un host TURN inexistente y credenciales compartidas en el cliente.
  - Se agregó `/api/turn-credentials` para entregar credenciales TURN temporales generadas en el servidor cuando se configura un relay Coturn compatible mediante `TURN_URLS` y `TURN_SHARED_SECRET`.
- **Build y cierre**:
  - Se corrigió el error de sintaxis en `P2PStreamTransport.disconnectSlot()` que impedía compilar el frontend.
  - `PodcastStudio.exe` y el pie de aplicación sincronizados a v1.2.6.0 / v1.2.6.

## 📦 Versión Previa: v1.2.5 (Auditoría Forense Integral + Seguridad + Chroma Key Real + ICE Robusto)
- **Auditoría Forense por Fases (7 fases completadas)**:
  - **Fase 1 - Conexiones WiFi/Remotas**: Timeout global 8s en descubridor ONVIF, heartbeat WebSocket 10s, reintentos RTSP/MJPEG con backoff, cancelación de escaneo al desmontar modal.
  - **Fase 2 - Audio/Mixing**: Recreación segura AudioContext, purga automática de fuentes muertas, mutex `isMixing`, cierre completo AudioContext al detener.
  - **Fase 3 - Renderizado/Canvas**: Fallback RAF si Web Worker falla, handler de visibilidad para pausar render en background, cleanup garantizado.
  - **Fase 4 - Grabación/Streaming**: Backpressure (`drain`) en pipe FFmpeg, reset `streamInitHeader` al detener streaming, rutas portables vía `app.getPath('videos')`/env var.
  - **Fase 5 - WebRTC**: `restartIce()` automático en `failed/disconnected`, `unsubscribe()` seguro con try/catch, limpieza ICE queues/timers.
  - **Fase 6 - Persistencia/Seguridad**: Encriptación XOR+Base64 para credenciales RTSP en localStorage (`storageCrypto.js`), try/catch en todos los `JSON.parse`, unificación de escrituras `cameraCrops`.
  - **Fase 7 - Hardware/Pulido**: Serial/Tally COM10+ con validación robusta, ErrorBoundary mejorado (logging + reintento), captura de escritorio moderna con fallback.
- **Chroma Key Real en Canvas**: Shader `applyChromaKey` con `getImageData/putImageData` para recorte verde real, reemplaza `mix-blend-screen` CSS.
- **Compilación Nativa `PodcastStudio.exe` v1.2.5.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.2.5.0` (299.008 bytes).

---

## 📦 Versión Previa: v1.1.8 (Repetición Instantánea / Instant Replay & Salida LAN Program / OBS Feed)
- **Motor de Repetición Instantánea Broadcast (P4.3)**:
  - **Búfer Circular en Memoria**: 30 segundos de señal PGM limpia continua en búfer circular de chunks WebM/H.264 sin penalización en GPU.
  - **Velocidad Variable de Slow-Motion**: Control táctil en cabina para reproducir a `0.25x`, `0.5x`, `0.75x` y `1.0x` con atajo global `[R]`.
  - **Replay Watermark Bug**: Distintivo broadcast en pantalla con baliza roja pulsante, indicador de velocidad y barra de progreso de clip.
  - **Corte Limpio a EN VIVO**: Botón `[ ⏹️ Volver a Vivo ]` y tecla `[Esc]` para conmutación inmediata a vivo sin cuadros negros ni desfase.
- **Salida LAN Program & Enrutamiento Virtual para OBS y vMix (P4.4)**:
  - **Servidor Web PGM 1080p60**: Endpoint `/program/feed` (y alias `/program`, `/pgm`) que transmite la señal limpia del Master directamente a fuentes *Navegador (Browser Source)* de OBS Studio, vMix y Smart TVs.
  - **Telemetría JSON `/program/status`**: Reporte de resolución 1080p, 60 fps, cámara PGM activa, layout y monitores conectados.
  - **Modal de Conexión Broadcast (`LanProgramOutputModal`)**: Código QR para vincular dispositivos móviles/pantallas, botón de copiado en 1 clic y guías de configuración.
- **Compilación Nativa `PodcastStudio.exe` v1.1.8.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.1.8.0` (298.496 bytes).

---

## 📦 Versión Previa: v1.1.7 (Grabación ISO Multicanal & Supresión Adaptativa de Ruido DSP)
- **Grabación ISO Multicanal de Pistas Independientes (P4.1)**:
  - **Grabación Aislada por Cámara (Isolated Recording)**: Captura simultánea en disco de cada cámara activa (CAM 1 a CAM 10) en formato Full HD 1080p limpio en `proyectos/[NombreProyecto]/ISO/`.
  - **Flujo Broadcast para Post-Producción NLE**: Archivos MP4 independientes sincronizados con `+faststart` para edición multicámara en Premiere Pro, DaVinci Resolve y Final Cut Pro.
  - **Selector Rápido en Cabina**: Botón conmutable `[ 🔴 Grabación ISO: ON/OFF ]` en el panel de grabación.
- **Supresión Adaptativa de Ruido DSP & Noise Gate (P4.2)**:
  - **Filtro Paso Alto 80 Hz**: Corte de subgraves y rumble para atenuar ventiladores, zumbido de aire acondicionado y golpes en la mesa.
  - **Puerta de Ruido Dinámica (Noise Gate Expander)**: Atenuación suave de -42 dBFS durante silencios con ataque ultrarrápido (3 ms) y liberación de 250 ms.
  - **Botón `[ 🛡️ DSP Anti-Ruido ]`**: Control individual por canal en la Consola de Mezcla Broadcast.
- **Compilación Nativa `PodcastStudio.exe` v1.1.7.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.1.7.0`.

---

## 📦 Versión Previa: v1.1.6 (Sala Multi-Invitados WebRTC, Retorno Limpio Mix-Minus N-1 & Auto-Cintillo por Voz)
- **Retorno Limpio Mix-Minus N-1 Real (P3.3)**:
  - Matriz de audio Mix-Minus que excluye la propia voz de cada invitado para cero retorno de eco.
- **Auto-Cintillo Inteligente por Reconocimiento de Voz (P3.3)**:
  - Detección dinámica de orador con filtro anti-ruidos (350ms) y temporizador de guarda de 4.5s.
- **Sala Centralizada Multi-Invitados (P3.3)**:
  - Panel visual `MultiGuestRoomModal` para hasta 8 invitados remotos y Screen WakeLock permanente.
- **Compilación Nativa `PodcastStudio.exe` v1.1.6.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.1.6.0`.

---

## 📦 Versión Previa: v1.1.5 (Atenuación Prioritaria Conductor, Teleprompter Broadcast Flotante/Tablet & Soundboard)
- **Auto-Ducking Prioritario de Conductor (P3.2)**:
  - Atenuación automática de música (al 20%, -14 dB) y cámaras secundarias (al 38%, -8.4 dB) cuando el conductor habla, eliminando el clamor cruzado.
- **Teleprompter Broadcast Flotante HUD & Espejo Óptico (P3.2)**:
  - Pantalla flotante semitransparente con inversión horizontal para espejos divisores 70/30, velocidad regulable (0.5x a 8x) y endpoint LAN `/prompter` para iPads.
- **Cartuchera Rápida de Efectos Soundboard Pad (P3.2)**:
  - 9 pads táctiles con atajos de teclado numérico (Numpad 1-9) y botón de corte instantáneo `[0]`.
- **Compilación Nativa `PodcastStudio.exe` v1.1.5.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.1.5.0` (298.496 bytes).

---

## 📦 Versión Previa: v1.1.4 (Tally Lights Broadcast LAN/Serial + Live Highlights & Auto-Clipper)
- **Sistema Tally Light Broadcast (P2.4)**:
  - **Tally Móvil Inalámbrico LAN (`/tally`)**: Convierte cualquier teléfono inteligente o tablet en luz de tally broadcast sobre la cámara vía WebSocket en tiempo real.
  - **Screen WakeLock API**: Pantalla permanentemente activa sin suspensión durante la transmisión.
  - **Hardware Serial USB (Arduino / ESP32)**: Detección nativa de puertos COM en Windows y emisión sincronizada de tramas (`TALLY:PGM=X,PVW=Y\n` y modo vMix/TallyArdu).
- **Marcador de Highlights y Recorte Automático de Clips (P3.1)**:
  - Botón de captura rápida `[ ⭐ HIGHLIGHT ]` y atajos de teclado globales `[H]` y `[M]`.
  - Disparadores automáticos por IA: debate cruzado por VAD y ovaciones/vítores por SFX.
  - Recorte temporal en 1 clic de clips virales en 9:16 vertical (1080x1920) y 16:9 con FFmpeg.
- **Compilación Nativa `PodcastStudio.exe` v1.1.4.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.1.4.0` (298.496 bytes).

---

## 📦 Versión Previa: v1.1.3 (Classroom, Pizarra Virtual, Q&A, Numpad SFX & Split-Stack 9:16)
- **Modo Classroom & Pizarra Virtual Broadcast (P2.1)**:
  - Pizarra virtual interactiva con lápiz, resaltador, figuras, puntero láser con estela y borrador, dibujada sobre la pantalla Master y quemada directamente en el video 1080p y streaming.
- **Panel Interactivo de Preguntas de Alumnos Q&A (P2.1)**:
  - Gestor de dudas con puesta al aire instantánea como cintillo broadcast (`[ PREGUNTA ]`).
- **Generador de Clips Verticales Split-Stack 9:16 (P2.2)**:
  - Formato vertical con orador arriba e invitado/pantalla abajo para TikTok, Reels y Shorts.
- **Radio Virtual Expandida & Cartuchera Numpad (P2.3)**:
  - Disparo de efectos de sonido con teclas `[1]` a `[9]` y corte con `[0]`.
  - Visualizador espectral de audio en tiempo real en Master Canvas.
- **Compilación Nativa `PodcastStudio.exe` v1.1.3.0**:
  - Binario ejecutable compilado con AssemblyVersion y FileVersion `1.1.3.0`.

---

## 📦 Versión Previa: v1.1.2 (Workspaces, IA Productora VAD, Subtitulado en Vivo & Telemetría)
- **Selector de Espacios de Trabajo Especializados (P1.1)**:
  - Selector en barra superior con 6 entornos contextuales de realización: Podcast Studio, Entrevista 1 a 1, Programa en Vivo / Talk Show, Clase Virtual / Webinar, Radio Virtual y Multicámara Pro.
- **Asistente IA Productor (Voice Activity Detection & Auto-Director) (P1.2)**:
  - Conmutador inteligente de cámaras en tiempo real que detecta la voz de los participantes mediante análisis acústico continuo, filtro anti-ruidos y detección de debate.
- **Subtitulado y Transcripción en Vivo (Open Captions) (P1.3)**:
  - Transcripción local de voz con Web Speech API integrada y quemado en el tercio inferior central del Master Canvas.
- **Telemetría y Salud de Emisión (Streaming Health) (P1.4)**:
  - Medición en tiempo real de FPS, bitrate de uplink y alerta de dropped frames.

---

## 📦 Versión Previa: v1.1.1 (Núcleo Broadcast de Audio Real, Consola Multicanal & Dual PVW/PGM)
- **Núcleo Broadcast de Audio Real (P0.1)**:
  - Enrutamiento directo de Música de Fondo (BGM) y Efectos de Sonido (SFX) al bus maestro sumador mediante Web Audio API (`masterBroadcastEngine`), garantizando grabación y streaming al 100% sin pérdida.
  - Cero latencia en reproducción de efectos con búferes en memoria (`AudioBufferCache`).
  - Auto-Ducking suave al hablar (atenuación al 25% con restauración gradual).
  - Aislamiento del retorno de audio local para evitar eco y retroalimentación del micrófono en bocinas de la cabina.
- **Consola de Mezcla de Audio Broadcast Multicanal (P0.4)**:
  - Botón de acceso `[ 🎛️ Consola Audio ]` en barra superior y tiras de canal profesionales (CAM 1 a CAM 10, Remotos, BGM, SFX, Monitor y Master PGM).
  - Faders verticales calibrados en dB, perillas de Ganancia Trim (-24dB a +18dB), botones MUTE y SOLO iluminados.
  - Vúmetros estéreo a 60 FPS actualizados por `requestAnimationFrame` sin re-renders de React.
  - Limitador Brickwall a -1.5 dBFS True Peak en Master para prevenir saturación y distorsión.
  - Botón Unity Reset para restablecer faders a 0 dB con un solo clic.
- **Motor Elástico Multicámara (6 a 10 ranuras) y 12 Layouts Broadcast (P0.2)**:
  - Expansión dinámica del estudio hasta 10 cámaras simultáneas (`+ CAM`).
  - 12 configuraciones broadcast tanto en monitor como en canvas 1080p: Plano Solo (1), PiP, Split 50/50 (2), Two-Shot, 3 Cams, Cuadrícula 4, Cuadrícula 6, Líder + 5 (6-lead), Cuadrícula 8, Cuadrícula 10, Galería Auto y Speaker View.
  - Conmutación con cero salto a negro (Zero-Black-Gap) manteniendo decodificación en GPU.
- **Switcher Dual Broadcast PREVIEW (PVW) / PROGRAM (PGM) (P0.3)**:
  - Botón `[ Dual PVW/PGM ]` para activar el entorno de realización con dos monitores paralelos (Tally Verde para PVW y Tally Rojo para PGM).
  - Consola central de realización con botón `[ CUT ]` instantáneo, botón `[ AUTO ]` (disolvencia de 300ms, 500ms o 1s) y palanca vertical interactiva **T-Bar** para transiciones manuales.
  - Insignias de tally `[ PGM ]` y `[ PVW ]` en tiempo real en los recuadros de cámara inferiores.

---

## 📦 Versión Anterior: v1.0.9 (Producción Oficial — Ultra Calidad, Zoom 1:1, Mando iPad & Proyectos Limpios)
- **Solución Definitiva de Reproducción de Video Master y Exportaciones (Fix Error `0xc00d36c4`)**:
  - Cierre ordenado y seguro de FFmpeg (`proc.stdin.end()`) que garantiza la escritura completa de la cabecera del contenedor, tablas de índices y atom `moov` con flag `+faststart`.
  - Descarga de archivos MP4 100% funcionales en resolución 1080p prístina sin trabas ni errores en Windows Media Player, reproductores móviles ni editores NLE.
  - Guardado directo del video master junto a su foto miniatura (`_Miniatura.jpg`) en la carpeta `Descargas` y `proyectos\`.
- **Monitor Master 100% Limpio de Indicadores**:
  - Eliminados el badge `CAM 1` y los botones flotantes de micrófono/bocina de la pantalla grande del Master para evitar obstrucciones con logotipos y cintillos.
  - Controles de micrófono y bocina mantenidos exclusivamente en los recuadros inferiores de cámaras.
- **Zoom Dinámico & Encuadre Interactivo 1:1 con el Mouse en Pantalla Master**:
  - Control de zoom interactivo y progresivo mediante la rueda del ratón (scroll) directamente sobre la pantalla grande del Master (paso de 0.04x).
  - **Mover y Centrar la Toma (Pan / Drag)**: Al mantener presionado el botón izquierdo del mouse sobre la pantalla Master, la imagen se recorre con seguimiento 1:1 pixel exacto como una ventana de Windows para centrar al conductor o a los invitados sin importar el nivel de ampliación.
  - El cursor cambia automáticamente a mano abierta (`grab`) y cerrada (`grabbing`) mientras se arrastra la toma.
  - Actualización reactiva instantánea sin desfase (`transition: none` durante el arrastre) y sincronización directa con el canvas master (`masterBroadcastEngine`) para grabación y streaming sin cortes.
  - HUD translúcido en pantalla con telemetría en tiempo real y botón de reinicio instantáneo `[ Reset 1.0x ]` en la barra superior.
- **Biblioteca de Efectos de Sonido Expandida**:
  - Nuevos efectos SFX integrados: Puertas abriéndose con chirrido, Cristales quebrándose, Personas carcajeándose / risas de público, Ring tones y llamadas telefónicas, Bocinas cómicas.
- **Nuevo Panel de Modulación y Efectos de Voz (Web Audio DSP en Tiempo Real)**:
  - Nueva sección desplegable en la barra lateral derecha para transformar la voz de los participantes en vivo:
    - *Voz Natural*: Sonido original de estudio sin procesar.
    - *Locutor Radio FM*: Compresión broadcast cálida + realce de presencia vocal.
    - *Estadio / Auditorio*: Reverberación espacial expansiva de graderías.
    - *Eco de Cabina*: Delay rítmico espaciado con retroalimentación.
    - *Marciano / Alien Robot*: Modulador en anillo cibernético a 72 Hz.
    - *Llamada Telefónica*: Filtro paso banda de 400Hz a 3.3kHz estilo celular antiguo.
    - *Voz Grave / Monstruo*: Filtro paso bajo y realce de frecuencias sub-graves.
    - *Ardilla / Agudo Cómico*: Realce hiperagudo estilo caricatura.
  - Selector de objetivo: aplicación a "Todos los micrófonos" o "Solo Master (CAM 1)".
- **Compilación Nativa `PodcastStudio.exe` v1.0.9.0**:
  - Binario ejecutable rápido y portable en la raíz con icono oficial de alta definición (285 KB) intacto.

---

## 📦 Versión Anterior: v1.0.8 (Producción Oficial)
- **Auto-Generación y Descarga de Miniaturas HD (.jpg)**:
  - Captura instantánea a 1080p directamente desde el canvas maestro (`captureMasterCanvasSnapshot()`) sin retraso ni dependencias de decodificación WebM.
  - Descarga automática de la miniatura oficial al descargar el archivo MP4 master o recortes para redes sociales.
  - Visualización real de la imagen en las tarjetas de previsualización del modal de exportación multi-formato.
  - Guardado de archivo de miniatura físico en el disco local (`[Timestamp]_Master_1080p_Thumbnail.jpg`).
- **Organización Centralizada de Proyectos**:
  - Almacenamiento estructurado en `D:\PROGRAMAS IA\PODCASTUDIO\proyectos\[NombreProyecto]\` con acceso directo desde la interfaz.
- **Transmisión y Grabación con Audio Master Prioritario**:
  - Micrófono de estudio principal (CAM 1 / interfaz de audio) protegido contra cortes durante cambios de cámara y control independiente de retorno.
  - Transición fluida entre cámaras sin cuadros negros.
- **Consola Remota Responsive para iPad y Tablets**:
  - Interfaz webRTC adaptativa para control táctil desde Safari / iPad.
  - Asignación libre y continua para cámaras móviles invitadas.

---

## 📦 Versión Anterior: v1.0.2
- **Búsqueda Automática de Cámaras Wi-Fi en Red Local**:
  - Sondeo en tiempo real de la red local Wi-Fi sin cambios de pestaña involuntarios ni saltos a la pestaña QR.
  - Detección de celulares iPhone/Android remotos, cámaras IP, presets de GoPro, cámaras de acción chinas y drivers de software (DroidCam, Iriun, Camo, OBS Virtual).
  - Asignación directa a cualquier ranura (CAM 1 a CAM 4) con un solo clic.
- **Aislamiento Total entre Ranuras de Video**:
  - Gestión independiente de `slotStreams`: conectar o dar de alta una cámara nunca sobreescribe ni desconecta otras ranuras activas.
  - Asignación inteligente al primer canal verdaderamente libre para conexiones móviles entrantes.
- **Botón de Eliminación y Desconexión por Ranura**:
  - Control explícito `[ 🗑️ Desconectar / Eliminar de CAM X ]` tanto en la barra superior de estado como en la tarjeta del dispositivo para liberar ranuras en caliente.
- **Transición Cero-Gap (Sin Pantalla Negra)**:
  - Pre-montaje persistente de todas las ranuras de cámara en el DOM (`display: none/block`) para conmutación instantánea toma a toma.
- **Emisión Multi-Streaming Optimizada**:
  - Inyección de cabecera EBML inicial (`cachedInitHeader`) en FFmpeg stdin al iniciar directo.
  - Compatibilidad TLS con validación `-tls_verify 0` en endpoints RTMPS de Facebook, YouTube y TikTok.
- **Indicador de Emisión "AL AIRE · EN VIVO"**:
  - Baliza luminosa pulsante en color verde esmeralda con cronómetro en tiempo real y botón de parada directa `[ ⏹️ DETENER EN VIVO ]`.
- **Compilación Nativa `PodcastStudio.exe` v1.0.2**:
  - Binario ejecutable rápido y portable en la raíz con icono oficial de alta definición (285 KB) embebido y metadatos de versión v1.0.2.
- **Acceso Directo Unificado**:
  - Botón único de "Configurar Entrada de Video" debajo de Escenarios Virtuales sin menús duplicados ni flechas rotas.

---

## 📦 Versión Anterior: v1.0.1 (Producción Oficial)
- **Marco de Ventana Broadcast**: Barra de título 100% negra (`#0a0a0a`) nativa de Windows integrada con la cabecera.
- **Identidad Oficial Limpia**: Logo vectorial oficial de PodcastStudio (sin duplicados ni imágenes rotas).
- **Control de Cámaras**: Botón de bote de basura (`Trash2`) en todas las ranuras para apagar señales activas y eliminar ranuras libres.
- **Delimitación de Estudio**: Barra inferior con versión activa y telemetría de emisión en tiempo real.
- **Monitor Master Limpio**: Área de video libre de indicadores flotantes y botón de **Cuadrícula de Encuadre (Regla de Tercios)** activable/desactivable en Master.
- **Grabación y Exportación Multi-Formato**: Contador de grabación en vivo con temporizador y apertura automática del panel de descarga multi-red (YouTube 16:9, Facebook, TikTok 9:16 e Instagram 1:1) junto con portadas oficiales.

---

## 🎯 Próximos Hitos (v1.1.9 — Fase P5.1 / P5.2)
- [x] P2.1: Modo Classroom interactivo con pizarra virtual y panel de preguntas de alumnos (v1.1.3).
- [x] P2.2: Generador de clips verticales Split-Stack 9:16 para TikTok y Shorts (v1.1.3).
- [x] P2.3: Radio Virtual expandida con cartuchera de cuñas por Numpad y analizador espectral (v1.1.3).
- [x] P2.4: Integración de Tally Light físico y móvil por red local Wi-Fi y USB/Serial (v1.1.4).
- [x] P3.1: Marcador de Highlights en vivo y recorte automático de clips virales FFmpeg (v1.1.4).
- [x] P3.2: Auto-Ducking multicanal dinámico por voz de conductor, teleprompter flotante broadcast y soundboard rápido (v1.1.5).
- [x] P3.3: Sala multi-invitados WebRTC con retorno limpio Mix-Minus N-1 y Auto-Cintillo dinámico por voz (v1.1.6).
- [x] P4.1: Grabación ISO Multicanal de pistas de video y audio independientes por cámara para post-producción NLE (v1.1.7).
- [x] P4.2: Filtro supresor de ruido adaptativo por IA (Noise Suppression DSP) (v1.1.7).
- [x] P4.3: Repetición Instantánea / Replay en Vivo con buffer circular de video (v1.1.8).
- [x] P4.4: Salida LAN Program & Enrutamiento Virtual para OBS, vMix y Smart TVs (v1.1.8).
- [ ] P5.1: Switcher Automatizado por Reconocimiento Facial / Detección de Mirada y Auto-Framing 1:1.
- [ ] P5.2: Generador de Transiciones Broadcast Stinger con canal alfa WebM y cortinillas animadas.
*(Regla de versionado estricto: después de v1.1.9 la siguiente versión corresponde a v1.2.1, nunca 1.1.10)*

---

## 🌟 Visión a Largo Plazo (v2.0.0)
- SFU Cloud Distribuido para producción de paneles de debate con hasta 16 invitados remotos simultáneos.
- Transcripción en vivo generada por IA para subtítulos automáticos en tiempo real.
- Switcher inteligente asistido por detección de voz para alternar cámaras de forma autónoma.
