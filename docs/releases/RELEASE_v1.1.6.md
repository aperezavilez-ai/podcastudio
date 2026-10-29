# 📜 NOTAS DE LA VERSIÓN — PODCASTUDIO v1.1.6

**Fecha de Lanzamiento:** 26 de Octubre de 2026  
**Estado:** Producción Oficial — Validado Forense  
**Versión Nativa:** `PodcastStudio.exe` v1.1.6.0  
**Fase de Implementación:** P3.3 / P4 (Sala Multi-Invitados WebRTC, Retorno Limpio Mix-Minus N-1 & Auto-Cintillo por Reconocimiento de Voz)

---

## 🌟 Novedades Principales de la Versión 1.1.6

### 🎧 1. Retorno Limpio Mix-Minus N-1 Real (Clean Feed Broadcast)
- **Eliminación Absoluta del Retorno de Eco**: En emisiones con participantes remotos conectados vía WebRTC, cada invitado debe escuchar la totalidad del programa al aire (micrófono del conductor, música de fondo, efectos de sonido y demás invitados) **restando su propia señal de micrófono**.
- **Buses Sumadores Dedicados**: Se implementó una matriz dinámica `mixMinusBuses` en `masterBroadcastEngine.js` (`createMediaStreamDestination`) que asigna a cada canal de invitado una señal personalizada de retorno N-1 en tiempo real.
- **Sincronización Automática en Caliente**: Conexión y desconexión transparente de fuentes BGM, SFX y pistas de cámara a los buses Mix-Minus activos mediante `syncAllMixMinusBuses()`.
- **Telemetría y Diagnóstico en Vivo**: Función `getMixMinusStatus()` que reporta el número de buses activos, canales excluidos y estado de emisión limpia.

### 🎙️ 2. Auto-Cintillo Inteligente por Reconocimiento de Voz (Dynamic Lower-Third)
- **Detección Automática de Orador**: Nuevo hook reactivo `useAutoSpeakerCintillo.js` que monitoriza los analizadores de energía acústica de cada cámara en tiempo real.
- **Filtro Anti-Ruidos y Persistencia (350ms)**: Previene disparos erróneos ante golpes de mesa, tos o ruidos breves, requiriendo alocución continua antes de lanzar el cintillo al aire.
- **Transición y Hold Inteligente**: Mantiene el cintillo en pantalla mientras la persona habla, extendiendo una guarda de 4.5 segundos tras el silencio, o conmutando de inmediato hacia el nuevo orador si otro participante toma la palabra.
- **Prioridad de Conductor**: Si el conductor (CAM 1) interviene, el cintillo principal adquiere precedencia.
- **Botón de Control en Barra Superior**: Botón `[ 🎙️ Auto-Cintillo ]` con baliza luminosa pulsante en color esmeralda cuando el sistema está activo.

### 👥 3. Sala Multi-Invitados Broadcast (`MultiGuestRoomModal.jsx`)
- **Gestión Centralizada de hasta 8 Invitados Remotos**: Panel de administración visual para las ranuras CAM 2 a CAM 10.
- **Enlace Maestro de Sala (`/camara?auto=true`)**: Enlace unificado para invitar panelistas sin configurar canales previamente; el sistema los asigna automáticamente a la primera ranura libre.
- **Enlaces Directos y Códigos QR por Cámara**: Acceso en 1 clic para compartir enlaces directos o escanear con iPhone/Android/iPad.
- **Edición en Vivo de Nombres y Cargos**: Los nombres y cargos editados en la consola se sincronizan al instante con los cintillos emitidos en pantalla.
- **Prevención de Suspensión (Screen WakeLock API)**: La pantalla del invitado remoto permanece encendida de forma indefinida durante la conexión en vivo.

---

## 🔍 Verificación Forense Realizada
- **Mix-Minus Routing**: Comprobado analíticamente que el bus de retorno de cada participante excluye su propio canal de entrada y suma el micrófono maestro, música y efectos.
- **Auto-Speaker Cintillo**: Verificado el ciclo de vida de persistencia mínima (350ms), conmutación de orador y temporizador de guarda de 4.5s.
- **Endpoints LAN**: Verificados `/room/status`, `/camara` con metadatos personalizados y WakeLock.
- **Consistencia de Versión**: Verificada la numeración estricta `v1.1.6` en `package.json`, `App.jsx`, `compile-exe.ps1` y compilación nativa.
