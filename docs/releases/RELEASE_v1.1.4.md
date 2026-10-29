# 🚀 PODCASTUDIO v1.1.4 - NOTAS DE LA VERSIÓN OFICIAL

**Fecha de Lanzamiento:** 26 de Octubre de 2026  
**Rama:** `v1.1` (Producción Broadcast Estable)  
**Binario Oficial:** `PodcastStudio.exe` (Versión del producto: `1.1.4.0`, 298.496 bytes)  
**Regla de Versionado Vigente:** `v1.1.1` ➔ `v1.1.2` ➔ `v1.1.3` ➔ `v1.1.4` ... ➔ `v1.1.9` ➔ `v1.2.1` (Prohibido `1.1.10`)

---

## 🎯 NOVEDADES Y MEJORAS DE LA FASE P2.4 Y P3.1 (v1.1.4)

### 🔴 1. Sistema Tally Light Broadcast (Inalámbrico LAN y Hardware Serial USB) (P2.4)
- **Tally Móvil Inalámbrico LAN (`http://<IP>:3001/tally`):**
  - Cualquier celular (iPhone / Android) o tablet montado sobre el trípode o zapata de la cámara se transforma al instante en un Tally Light profesional sin instalar aplicaciones.
  - Conexión WebSocket de latencia ultra baja (`ws://<IP>:3001`) con fallback a polling cada 900 ms.
  - Indicador visual a pantalla completa:
    - 🔴 **PROGRAM (Al Aire):** Pantalla en rojo broadcast intenso (`#dc2626`), insignia pulsante `● AL AIRE / ON AIR`, número gigante y pulso de vibración háptica al entrar al aire.
    - 🟢 **PREVIEW (Próxima):** Pantalla en verde broadcast (`#15803d`) con insignia `★ PREVIEW / PRÓXIMO`.
    - ⚫ **STANDBY:** Modo discreto en gris oscuro (`#0c0d12`).
  - **Screen WakeLock API Integrado:** Mantiene la pantalla del celular siempre encendida para que nunca se suspenda durante la transmisión en vivo.
  - Selector táctil de canal en pantalla (CAM 1 a CAM 10) y soporte para parámetros de URL directos (`/tally?cam=1`, `/tally?cam=2`, etc.).

- **Integración Hardware Serial / USB (Arduino, ESP32, M5Stack, Relays):**
  - Detección automática de puertos COM de Windows mediante PowerShell sin librerías nativas incompatibles.
  - Transmisión en tiempo real de cadenas broadcast:
    - Formato estándar: `TALLY:PGM=X,PVW=Y\n`
    - Formato vMix / TallyArdu: `X=1\n` (1: PGM, 2: PVW, 0: OFF).
  - Selector de Baud Rate (9600, 19200, 57600, 115200 bps) y conmutación automática sincronizada con CUT, AUTO y T-Bar.
  - Botones de prueba física manual en interfaz para encender LEDs de PGM, PVW o apagado general.

### ⭐ 2. Marcador de Highlights en Vivo & Recorte Automático de Clips (P3.1)
- **Botón y Atajos de Teclado en Grabación (`[H]` y `[M]`):**
  - Al estar grabando, el panel superior muestra el botón activo `[ ⭐ HIGHLIGHT ]` con contador en vivo.
  - Al presionar el botón o las teclas `H`/`M`, se marca un momento destacado con punto de inicio anticipado (-6s) para preservar el contexto de la intervención.
- **Detección Automática de Momentos Virales:**
  - **Debate Intenso VAD:** Al generarse cruce simultáneo de voces que activa el layout 2-shot o galería.
  - **Ovaciones y Aplausos SFX:** Al dispararse efectos de aplausos o vítores en vivo.
- **Exportación Automática en 1 Clic con FFmpeg:**
  - En el modal de exportación `MultiFormatExportModal`, cada highlight cuenta con botones dedicados `[ Clip 9:16 ]` y `[ 16:9 ]`.
  - Recorte temporal exacto de 30 o 60 segundos con reencuadre vertical centrado, codificación H.264 ultrafast, miniatura JPG y guardado directo en `proyectos/<Proyecto>/Clips/` y en la carpeta `Descargas`.

---

## 🔬 VALIDACIÓN FORENSE AUTOMATIZADA (`forensic-p3-results.json`)

Se ejecutó la suite de verificación automatizada dentro del motor Electron (`scripts/forensic-p3-test.js`):

| Módulo / Prueba | Metodología | Resultado |
| :--- | :--- | :--- |
| **Tally State Model** | Simulación de conmutación PGM/PVW en matriz 4/10 canales | ✅ VERIFIED AUTOMATED |
| **Serial Protocol** | Validación de cadenas estándar y vMix (`TALLY:PGM=3,PVW=2\n`) | ✅ VERIFIED AUTOMATED |
| **Live Highlights Engine** | Generación de marcas manuales, VAD y SFX con offsets temporales | ✅ VERIFIED AUTOMATED |
| **FFmpeg Clip Trimming** | Validación de parámetros `-ss`, `-t`, `-vf crop/scale` | ✅ VERIFIED AUTOMATED |
| **Version & Binary PE** | `package.json` v1.1.4, binario `PodcastStudio.exe` (298.496 bytes) | ✅ VERIFIED REAL |

---

## 📦 REGISTRO DE ARCHIVOS MODIFICADOS Y CREADOS

1. `electron/main.js`: Agregadas rutas Express `/tally`, `/tally/status`, gestión de clientes WebSocket Tally, handlers IPC `list-serial-ports`, `send-tally-serial` y `export-highlight-clip`.
2. `electron/preload.js`: Expuestos métodos de Tally, puertos seriales y exportación de clips en `window.api`.
3. `src/hooks/useLiveHighlights.js`: Nuevo hook de gestión de highlights con cálculo de offsets y atajos de teclado `H` y `M`.
4. `src/components/TallySettingsModal.jsx`: Nueva interfaz de monitoreo y configuración de Tally LAN y serial USB.
5. `src/components/MultiFormatExportModal.jsx`: Integrada lista de highlights con recorte automático 9:16 / 16:9 con 1 clic.
6. `src/App.jsx`: Integrado botón Tally en barra superior, botón Highlight durante grabación, enlaces con VAD y Numpad SFX, y pie de página actualizado a `v1.1.4`.
7. `src/pages/StudioRemoteControl.jsx`: Actualizado pie de página a `v1.1.4`.
8. `package.json`: Versión actualizada a `1.1.4`.
9. `launcher.cs`: Metadatos de ensamblado actualizados a `1.1.4.0`.
10. `PodcastStudio.exe`: Binario nativo PE compilado con versión `1.1.4.0` (298.496 bytes).
11. `scripts/forensic-p3-test.js`: Suite forense automatizada con reporte en `test_output/forensic-p3-results.json`.
