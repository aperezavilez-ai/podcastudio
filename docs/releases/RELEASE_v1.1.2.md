# 📢 PODCASTUDIO v1.1.2 — NOTAS DE LA VERSIÓN OFICIAL
**Virtual Production Studio: Workspaces, IA Productora VAD, Subtitulado en Vivo & Telemetría Broadcast**  
**Fecha de Publicación:** 26 de Octubre de 2026  
**Binario Oficial:** `PodcastStudio.exe` (Versión del producto: `1.1.2.0`, 298.496 bytes)  
**Regla de Versionado Vigente:** `v1.1.1` ➔ `v1.1.2` ... ➔ `v1.1.9` ➔ `v1.2.1` (Prohibido `1.1.10`)

---

## 🚀 NOVEDADES Y MEJORAS DE LA FASE P1 (v1.1.2)

### 1. P1.1 — Selector de Espacios de Trabajo (Workspaces Especializados)
Nuevo selector en la barra superior que transforma la interfaz, los layouts de cámara y los paneles según la modalidad de producción elegida:
* **Podcast Studio:** Configuración clásica para debates y tertulias (4 cámaras), con acceso directo a música de fondo y efectos SFX.
* **Entrevista 1 a 1:** Plano doble (Two-Shot) simétrico, cintillos de presentador e invitado y tally visual.
* **Programa en Vivo / Talk Show:** Entorno broadcast de televisión con doble monitor Preview/Program (PVW/PGM), transiciones disueltas AUTO y cintillos dinámicos.
* **Clase Virtual / Webinar:** Pantalla compartida o presentación en grande con recuadro PiP del docente y teleprompter/apuntes integrados.
* **Radio Virtual:** Interfaz orientada a audio prioritario, ecualización y efectos vocales de locutor, cartuchera de jingles y vúmetros prominentes.
* **Multicámara Pro:** Muro multiview de 8 a 10 señales con matriz rápida de conmutación.

### 2. P1.2 — Asistente IA Productor (Voice Activity Detection & Auto-Director)
Motor inteligente en tiempo real que asiste al realizador en la conmutación de cámaras:
* **Detección Acústica VAD:** Analiza en tiempo real los niveles de audio de cada participante.
* **Filtro Anti-Falsos Positivos:** Requiere al menos 800 ms de voz sostenida para conmutar, ignorando carraspeos, toses o ruidos breves.
* **Detección de Debate / Cruce de Palabras:** Si dos o más personas hablan a la vez, conmuta automáticamente a plano doble (Two-Shot) o cuadrícula general.
* **Sensibilidad y Cooldown Configurables:** Ajustes de sensibilidad (Baja, Media, Alta) y tiempos mínimos de permanencia de plano (1.5s a 6s) para evitar cortes bruscos.
* **Prioridad Humana Garantizada:** El realizador siempre puede intervenir pulsando CUT o seleccionando una cámara manualmente.

### 3. P1.3 — Subtitulado en Vivo y Transcripción (Open Captions)
* **Reconocimiento Local de Voz:** Procesamiento en tiempo real mediante Web Speech API nativa sin enviar audio a servidores externos ni costos de API.
* **Subtítulos Quemados en PGM:** Superposición estética en la zona inferior central del video Master (1080p), grabados directamente en el archivo MP4 y transmitidos al streaming RTMP.
* **Soporte Multilingüe:** Selección inmediata entre Español (México/LATAM), Español (España), Inglés y Portugués.
* **Bitácora de Transcripción:** Registro cronológico de frases emitidas durante la sesión.

### 4. P1.4 — Telemetría y Salud de Emisión (Streaming Health)
* **Monitor en Tiempo Real:** Medición de tasa de cuadros real (FPS), tasa de bits (kb/s) y velocidad de codificación.
* **Detector de Dropped Frames:** Alerta visual temprana (insignia ámbar/verde) en caso de congestión de red o pérdida de cuadros hacia el servidor RTMP.

---

## 🛠️ SUITE FORENSE Y CONTROL DE REGRESIONES
* **Compilación Frontend:** `vite build` completado exitosamente sin advertencias críticas de módulos.
* **Compilación Binario:** `PodcastStudio.exe` compilado con AssemblyVersion `1.1.2.0` y FileVersion `1.1.2.0`.
* **Pruebas Forenses P1:** Ejecutadas en `scripts/forensic-p1-test.js` certificando el 100% de los algoritmos (Workspaces, VAD, Subtítulos en Canvas 1080p y Parser de Telemetría).
