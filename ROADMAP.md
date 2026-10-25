# 🗺️ ROADMAP OFICIAL — PODCASTSTUDIO

Documento maestro de desarrollo, hitos alcanzados y próximas fases del estudio broadcast.

---

## 🚀 Versión Actual: v1.0.8 (Producción Oficial - Release Estable)
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
- **Compilación Nativa `PodcastStudio.exe` v1.0.8.0**:
  - Ejecutable de alta velocidad con icono oficial preservado (285 KB).

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

## 🎯 Próximos Hitos (v1.1.0)
- [ ] Soporte para balance de blancos manual y controles ISO remotos desde la PC.
- [ ] Integración de selector multicámara con tally light físico (vía USB/Serial).
- [ ] Banco de efectos de sonido con disparadores por atajos de teclado numérico (Numpad).
- [ ] Auto-detección de encuadre facial por IA en el corte vertical para TikTok y Reels.

---

## 🌟 Visión a Largo Plazo (v2.0.0)
- SFU Cloud Distribuido para producción de paneles de debate con hasta 16 invitados remotos simultáneos.
- Transcripción en vivo generada por IA para subtítulos automáticos en tiempo real.
- Switcher inteligente asistido por detección de voz para alternar cámaras de forma autónoma.
