# 📜 NOTAS DE LA VERSIÓN — PODCASTUDIO v1.1.8

**Fecha de Lanzamiento:** 26 de Octubre de 2026  
**Estado:** Producción Oficial — Validado Forense (17/17 Pruebas Exitosas)  
**Versión Nativa:** `PodcastStudio.exe` v1.1.8.0 (298.496 bytes)  
**Fase de Implementación:** P4.3 / P4.4 (Repetición Instantánea / Instant Replay Broadcast & Salida LAN Program / OBS Virtual Feed)

---

## 🌟 Novedades Principales de la Versión 1.1.8

### ⏪ 1. Motor de Repetición Instantánea / Instant Replay en Vivo (P4.3)
- **Búfer Circular Broadcast en Memoria (30 Segundos)**:
  - Almacena de forma continua y transparente los últimos 10 a 30 segundos de transmisión Master limpia a 1080p sin penalización en GPU ni caídas de fotogramas.
  - Retención dinámica de paquetes WebM/H.264 estructurados con la cabecera EBML inicial (`cachedInitHeader`) para una reconstrucción de clip 100% válida.
- **Reproducción a Velocidad Variable (Slow-Motion)**:
  - Presets de velocidad broadcast: `0.25x`, `0.5x`, `0.75x` y `1.0x`.
  - Disparadores rápidos en cabina: `[ ⏪ 5 Seg ]`, `[ ⏪ 10 Seg ]` y `[ ⏪ 15 Seg ]`.
  - Atajo global de teclado **`[R]`**: Dispara repetición instantánea de 5 segundos a 0.5x con un solo toque y regresa de inmediato a vivo al presionarlo nuevamente.
- **Distintivo Visual Broadcast (Replay Bug) Quemado en PGM**:
  - Indicador superior con baliza roja neón pulsante, etiqueta `"REPLAY"`, multiplicador `"· 0.5x SLOW"` y barra de progreso inferior de clip.
  - Se quema en tiempo real en la señal del Master Canvas, garantizando que aparezca en la grabación MP4 y en la transmisión RTMP/LAN.
- **Corte Limpio a EN VIVO (Cut to Live)**:
  - Botón táctil `[ ⏹️ VOLVER A VIVO ]` y tecla `[Esc]` para cortar la repetición al instante sin desfases ni congelamientos.

### 📡 2. Salida LAN Program & Enrutamiento Virtual para OBS y vMix (P4.4)
- **Señal Master 1080p60 Limpia a través de la Red Local**:
  - Servidor HTTP/WebSocket que expone la señal PGM completa en `http://[IP_LOCAL]:3001/program/feed` (y alias `/program`, `/pgm`).
  - **OBS Studio**: Ingesta nativa directa a través de fuente tipo *Navegador (Browser Source)* a 1920x1080 @ 60 FPS sin necesidad de capturadoras de video HDMI.
  - **vMix Broadcast**: Entrada directa vía *Web Browser* para producción híbrida profesional.
  - **Monitores de Retorno / Smart TVs**: Pantalla completa sin barras de navegación, cursor auto-ocultable y soporte para la API **Screen WakeLock** para evitar que los televisores de estudio entren en suspensión.
- **Telemetría en Tiempo Real de la Emisión (`/program/status`)**:
  - Endpoint JSON que informa resolución (`1920x1080`), tasa de cuadros (`60 fps`), cámara PGM activa, layout actual, estado de streaming/grabación y cantidad de monitores LAN conectados.
- **Modal de Conexión en 1 Clic (`LanProgramOutputModal`)**:
  - Acceso directo desde la barra superior mediante el botón `[ 📡 Salida LAN / OBS ]`.
  - Botón de copiado con feedback visual `[ 📋 Copiar ]`, botón `[ 🌐 Abrir ]` y Código QR automático para vincular iPads y pantallas en segundos.
  - Guía rápida paso a paso para configurar fuentes en OBS, vMix y Smart TVs.

---

## 🔍 Verificación Forense Realizada
- **Suite Automatizada `scripts/forensic-p7-test.js`**: 17/17 pruebas superadas al 100% (`test_output/forensic-p7-results.json`).
- **Control de Versiones Estricto**:
  - `package.json`: `"version": "1.1.8"`
  - `src/App.jsx`: Footer oficial `PODCASTUDIO v1.1.8`
  - `PodcastStudio.exe`: Compilado con FileVersion y ProductVersion `1.1.8.0`.
  - Regla estricta verificada: versión posterior a `v1.1.8` será `v1.1.9` (y luego `v1.2.1`), nunca `1.1.10`.
