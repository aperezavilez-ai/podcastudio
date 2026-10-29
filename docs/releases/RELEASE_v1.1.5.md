# 📜 NOTAS DE LA VERSIÓN — PODCASTUDIO v1.1.5

**Fecha de Lanzamiento:** 26 de Octubre de 2026  
**Estado:** Producción Oficial — Validado Forense  
**Versión Nativa:** `PodcastStudio.exe` v1.1.5.0 (298.496 bytes)  
**Fase de Implementación:** P3.2 (Atenuación Prioritaria de Conductor, Teleprompter Broadcast Flotante/Tablet & Cartuchera Soundboard Rápida)

---

## 🌟 Novedades Principales de la Versión 1.1.5

### 🎙️ 1. Auto-Ducking Multicanal Dinámico por Conductor (Host Priority Ducking)
- **Eliminación Total del Clamor Cruzado**: Cuando el conductor principal (CAM 1) interviene, el sistema Web Audio atenúa de forma fluida y proporcional tanto la música de fondo (BGM al 20%, -14 dB) como los canales de invitados y cámaras secundarias (CAM 2 a CAM 10 y señales remotas al 38%, -8.4 dB).
- **Audio Graph Broadcast sin Chasquidos**: Se integró un nodo `duckingGain` en cada tira de canal entre el fader y el mute (`trimGain -> faderGain -> duckingGain -> muteGain -> soloGain`), permitiendo curvas de ataque de 60ms y recuperación gradual de 450ms sin alterar los faders manuales ni provocar saltos acústicos.
- **Detección Automática de Voz (VAD)**: El motor reacciona en tiempo real cuando el nivel acústico del micrófono del conductor supera el umbral de palabra, restaurando el volumen normal al detectar silencio.

### 📜 2. Teleprompter Broadcast Flotante HUD & Espejo Óptico
- **Pantalla Flotante Semitransparente**: HUD posicionable y redimensionable con control de opacidad (20% a 100%) para leer el guion directamente sobre el monitor de realización o la cámara.
- **Soporte para Cristales Divisores 70/30 (Mirror Flip)**: Inversión horizontal instantánea (`transform: scaleX(-1)`) y vertical para montar la pantalla detrás de capuchas y espejos profesionales de estudio.
- **Desplazamiento Sub-Píxel Fluido a 60 FPS**: Motor cinético con velocidades configurables desde 0.5x hasta 8x, atajos de teclado (`[Espacio]` para pausa/reanudación, flechas para velocidad) y guía visual de línea de mirada (*Eyeline Marker*).
- **Cálculo de Métricas de Lectura**: Contador de palabras y estimación de tiempo de locución en minutos en tiempo real.
- **Acceso Remoto para Tablets e iPads (`/prompter`)**: Servidor LAN que transmite el guion a cualquier iPad o tablet colocado sobre el teleprompter físico sin cables y con bloqueo de apagado de pantalla (*Screen WakeLock*).

### 🎛️ 3. Cartuchera Rápida de Efectos de Sonido (Soundboard Quick Pad)
- **9 Pads Táctiles de Disparo Inmediato**: Botones con código de color broadcast para efectos esenciales (Aplausos, Corneta, Carcajadas, Vítores, Cristales, Puertas, Timbre, Grillos y Palmas).
- **Mapeo al Teclado Numérico (Numpad 1 a 9)**: Disparo instantáneo con teclado físico y botón de parada de emergencia maestro `[0]` para cortar el sonido al instante.
- **Feedback Visual de Emisión**: Animación de onda expansiva al reproducir y medidor de estado de audio activo.

---

## 🔍 Verificación Forense Realizada
- **Host Priority Ducking**: Comprobado analíticamente y en ejecución: Ganancia de CAM 1 en 1.0, canales secundarios atenuados a 0.38 y BGM a 0.20 durante la voz del conductor.
- **Teleprompter Metrics**: Comprobado conteo de palabras, cálculo de minutos de lectura y matriz CSS de inversión en espejo.
- **Soundboard Quick Pad**: Verificados los 9 disparadores en memoria con cero latencia y atajos de teclado numérico.
- **Compilación Nativa**: Verificado binario `PodcastStudio.exe` v1.1.5.0 en Windows.
