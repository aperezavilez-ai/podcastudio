# 🚀 PodcaStudio v1.1.1 — Virtual Production Studio (Multicámara, Dual PVW/PGM & Consola Broadcast)

Fecha de Release: 26 de Octubre, 2026  
Ejecutable: `PodcastStudio.exe` (v1.1.1.0)  
Plataforma: Windows (Electron + .NET Launcher con Icono HD de 285 KB intacto)  
Servicio Cloud / Mando: `https://www.podcastudio.mx`

---

## 🌟 Novedades y Mejoras Implementadas

### 1. Núcleo Broadcast de Audio Real (P0.1)
- **Música de Fondo (BGM) en Grabación y En Vivo**: La música seleccionada se inyecta directamente al bus sumador maestro mediante Web Audio API (`connectBgmAudioElement`), garantizando que se graba en el archivo MP4 y se transmite en el stream RTMP sin pérdidas.
- **Efectos de Sonido (SFX) Integrados**: Los efectos (risas, aplausos, cristales rotos, puertas, timbres) se decodifican en búferes de memoria (`AudioBuffer`) y se reproducen sin latencia mezclándose de manera nativa en el master de grabación y retorno.
- **Auto-Ducking Dinámico**: Atenuación suave y progresiva al 25% cuando el conductor o invitados hablan por el micrófono, restableciendo el volumen de forma imperceptible.
- **Aislamiento de Retorno en Cabina**: Se separó el bus de monitoreo local (`monitorSumGain`) del bus de emisión (`masterSumGain`), eliminando por completo el eco y la retroalimentación acústica del micrófono en los altavoces de la computadora.

### 2. Consola de Mezcla de Audio Broadcast Multicanal (P0.4)
- **Acceso Directo**: Botón destacado `[ 🎛️ Consola Audio ]` en la barra superior del estudio.
- **Tiras de Canal Profesionales**:
  - Tiras individuales para cada cámara y micrófono activo (Master Mic CAM 1, CAM 2 a CAM 10, y llamadas remotas).
  - Tira auxiliar para BGM (Música de fondo) con control de atenuación y estado.
  - Tira auxiliar para SFX (Efectos de sonido en memoria).
  - Fader de Retorno / Auriculares de Cabina (Monitor Out).
  - Tira MASTER PGM con limitador True Peak Brickwall a -1.5 dBFS para evitar cualquier saturación o distorsión digital.
- **Controles por Canal**: Fader vertical calibrado en dB, perilla Trim de ganancia (-24 dB a +18 dB), botones iluminados MUTE y SOLO.
- **Vúmetros a 60 FPS**: Barras de medición estéreo de alta resolución con código de color (Verde -48dB, Amarillo -12dB, Rojo -3dB a Clip) actualizadas por `requestAnimationFrame` sin sobrecargar la interfaz.
- **Botón Unity Reset**: Restablece todos los faders a 0 dB con un solo clic.

### 3. Motor Elástico Multicámara (6 a 10 Cámaras) y 12 Layouts Broadcast (P0.2)
- Soporte dinámico para expandir el estudio hasta 10 cámaras simultáneas (`+ CAM`).
- 12 configuraciones de pantalla broadcast implementadas tanto en el monitor como en el compositor de video 1080p:
  1. `1`: Plano Solo (pantalla completa)
  2. `pip`: Picture-in-Picture con ventana flotante
  3. `2`: Split screen 50/50
  4. `two-shot`: Plano de entrevista doble con marcos estéticos
  5. `3`: 3 cámaras en mosaico dinámico
  6. `4`: Cuadrícula 2x2 equilibrada
  7. `6`: Cuadrícula 3x2 (6 participantes)
  8. `6-lead`: Conductor principal en grande (60%) y 5 cámaras auxiliares a la derecha
  9. `8`: Cuadrícula 4x2 para paneles y mesas de debate
  10. `10`: Cuadrícula 5x2 broadcast completo
  11. `gallery`: Cuadrícula adaptativa inteligente
  12. `speaker`: Orador activo en grande (76%) con carrusel inferior de participantes
- **Cero Salto a Negro (Zero-Black-Gap)**: Todos los slots de video permanecen decodificando de forma persistente en GPU en segundo plano.

### 4. Switcher Dual Broadcast PREVIEW (PVW) / PROGRAM (PGM) (P0.3)
- **Botón Switcher Dual**: Activa el entorno de producción broadcast con dos pantallas paralelas:
  - **PREVIEW (PVW) en Verde**: Muestra la siguiente toma que el director está preparando, con barra de botones de cámara en tally verde.
  - **PROGRAM (PGM) en Rojo**: Muestra la señal oficial en el aire / grabación con todos los overlays, cintillos 3D, logo y encuadre activo.
- **Consola Central de Realización**:
  - Botón `[ CUT ]`: Corte directo instantáneo que conmuta Preview y Program.
  - Botón `[ AUTO ]`: Disolvencia suave y temporizada (configurable a 300ms, 500ms o 1s).
  - **Palanca T-Bar Vertical Interactiva**: Fader industrial con el que el productor puede realizar transiciones manuales fluidas arrastrando con el ratón.
- **Tally en Tarjetas de Cámaras**: Cada recuadro inferior de cámara muestra claramente su estado con insignias `[ PGM ]` (rojo) o `[ PVW ]` (verde).
