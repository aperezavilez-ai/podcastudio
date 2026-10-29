# 📜 NOTAS DE LA VERSIÓN — PODCASTUDIO v1.1.7

**Fecha de Lanzamiento:** 26 de Octubre de 2026  
**Estado:** Producción Oficial — Validado Forense  
**Versión Nativa:** `PodcastStudio.exe` v1.1.7.0  
**Fase de Implementación:** P4.1 / P4.2 (Grabación ISO Multicanal de Pistas Independientes & Supresión Adaptativa de Ruido de Audio DSP)

---

## 🌟 Novedades Principales de la Versión 1.1.7

### 🎬 1. Grabación ISO Multicanal de Pistas Independientes (P4.1)
- **Grabación Aislada de Cámaras en Disco (Isolated Recording)**: Al grabar la emisión Master del programa, el sistema puede grabar simultáneamente cada ángulo de cámara activo (CAM 1, CAM 2, CAM 3, etc.) de manera limpia y sincronizada en formato MP4 Full HD 1080p a 30 FPS en `proyectos/[NombreProyecto]/ISO/`.
- **Estructura Broadcast para Edición Multicámara**:
  - Salida Master: `[Timestamp]_Master_1080p.mp4`
  - Salidas ISO: `[Timestamp]_CAM1_ISO.mp4`, `[Timestamp]_CAM2_ISO.mp4`, `[Timestamp]_CAM3_ISO.mp4`, etc.
  - Compatibilidad total con líneas de tiempo multicámara sincronizadas en Adobe Premiere Pro, DaVinci Resolve y Final Cut Pro.
- **Pipeline de Rendimiento Ultra Ligero**:
  - Instanciación de grabadores `MediaRecorder` directos por flujo de cámara con codificación paralela en procesos FFmpeg en segundo plano (`start-iso-recording`, `record-iso-chunk`, `stop-iso-recording`).
  - Cierre ordenado de cabeceras de contenedor con `+faststart` para cero archivos corruptos o trabados.
- **Control Intuitivo en Cabina**:
  - Selector conmutable `[ 🔴 Grabación ISO: ON/OFF ]` en el panel lateral de grabación para activar o desactivar la captura ISO sin interrumpir la operación del switcher.

### 🛡️ 2. Supresión Adaptativa de Ruido de Audio DSP & Noise Gate (P4.2)
- **Filtro Paso Alto Butterworth (80 Hz Rumble Cut)**:
  - Elimina zumbidos de aire acondicionado, vibraciones de ventiladores de computadora, ruidos eléctricos de 50/60 Hz y golpes secos en la mesa del estudio sin alterar el cuerpo ni la calidez de las voces humanas.
- **Puerta de Ruido Dinámica (Noise Gate Expander)**:
  - Atenúa suavemente el canal en -42 dBFS durante las pausas de silencio, eliminando el siseo residual del micrófono y la reverberación de la sala.
  - Curva de ataque ultrarrápida (3 ms) para conservar intacto el ataque de cada consonante, con liberación suave de 250 ms para evitar cortes bruscos o respiración artificial de audio.
- **Botón `[ 🛡️ DSP Anti-Ruido ]` en la Consola de Audio**:
  - Cada tira de canal en la Consola de Mezcla Broadcast cuenta con un botón iluminado en color cian para encender o apagar la supresión de ruido de forma individual por participante.

---

## 🔍 Verificación Forense Realizada
- **ISO Recording Pipeline**: Verificados los IPC handlers `start-iso-recording`, `record-iso-chunk`, `stop-iso-recording` y `get-iso-status`.
- **Audio DSP Chain**: Verificada la inserción física de nodos `highPassFilter` (80 Hz) y `noiseGateNode` en cada tira de canal entre el Trim y el Fader, conmutables en caliente mediante `setChannelNoiseSuppression()`.
- **Consistencia de Versión**: Verificada la numeración estricta `v1.1.7` en `package.json`, `App.jsx`, `compile-exe.ps1` y compilación nativa.
