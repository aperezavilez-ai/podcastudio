# 📦 RELEASE v1.0.1 — PODCASTSTUDIO PRO

**Fecha de Lanzamiento:** 22 de Octubre de 2026  
**Rama:** `main`  
**Estado:** Producción Oficial  
**URL Web:** [https://www.podcastudio.mx](https://www.podcastudio.mx)  
**Captura Remota:** [https://www.podcastudio.mx/remote-cam](https://www.podcastudio.mx/remote-cam)

---

### 🌟 Novedades y Correcciones Clave

1. **Conexión Segura de Cámaras Celulares en la Nube (`podcastudio.mx`)**:
   - Se eliminó la dependencia de URLs locales (`192.168.1.x:3000`) que causaban pantalla blanca y rechazo de certificados SSL en iOS Safari y Android.
   - El código QR y los botones de invitación ahora generan enlaces directos a `https://www.podcastudio.mx/remote-cam?slot=X&room=studio_cam_X`.
   - Se habilitó el componente ultraligero y adaptativo de cámara para móviles `RemoteCam.jsx` con botón de activación, alternador de cámara frontal/trasera, linterna, mute y control de bitrate.

2. **Diseño Visual de la Ventana Windows (100% Negro Broadcast)**:
   - Eliminada la barra blanca/gris predeterminada de Windows mediante `titleBarStyle: 'hidden'` y `titleBarOverlay` en negro azabache (`#0a0a0a`) con controles de ventana blancos.
   - Eliminados logotipos rotos y nombres duplicados en la cabecera.
   - Reemplazado por un escudo vectorial con gradiente naranja broadcast y tipografía unificada `PodcastStudio`.

3. **Bote de Basura y Control Total de Cámaras (CAM 1 a CAM 4+)**:
   - Añadido botón de bote de basura (`Trash2`) en todas las tarjetas de cámara.
   - Al pulsar en una cámara activa: apaga los tracks de video y audio inmediatamente y restablece la ranura a "SIN SEÑAL".
   - Al pulsar en una ranura secundaria vacía: elimina la ranura de la vista de cámaras.

4. **Barra de Delimitación Inferior y Versión Actual**:
   - Barra delimitadora horizontal en el borde inferior que muestra el estado activo `● PODCASTUDIO v1.0.1 | Estudio Broadcast Pro`.
   - Información de telemetría: Motor WebRTC + Canvas Master, Salida 1080p @ 30fps.

5. **Actualización del Ejecutable Nativo (`PodcastStudio.exe`)**:
   - Recompilado con .NET `csc.exe` v4.0 e incrustando el icono oficial `icon.ico`.
   - Lanzador rápido sin destello de terminal cmd ni demoras de servidor.
