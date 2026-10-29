# 📦 RELEASE v1.0.8 — PODCASTUDIO PRO

**Fecha de Lanzamiento:** 24 de Octubre de 2026  
**Rama:** `main`  
**Estado:** Producción Oficial  
**URL Web:** [https://www.podcastudio.mx](https://www.podcastudio.mx)  
**Consola Remota iPad / Control:** [https://www.podcastudio.mx/remote-control](https://www.podcastudio.mx/remote-control)  
**Cámara Móvil HD:** [https://www.podcastudio.mx/remote-cam](https://www.podcastudio.mx/remote-cam)

---

### 🌟 Novedades y Correcciones Clave

1. **Auto-Generación y Descarga de Miniaturas HD (.jpg) al Descargar Video**:
   - **Cero tiempo de espera**: Se implementó `captureMasterCanvasSnapshot()` en `masterBroadcastEngine.js` para extraer instantáneamente (0 ms) un fotograma nítido en 1080p del lienzo maestro antes de apagar la emisión o grabación.
   - **Descarga combinada automática**: Al pulsar descargar el video Master `.mp4` o cualquier recorte para redes, el sistema descarga automáticamente la miniatura oficial `.jpg` en alta resolución (`[NombreProyecto]_Miniatura.jpg`).
   - **Previsualización real en tarjetas**: En el modal de exportación multi-formato (`MultiFormatExportModal`), las tarjetas de previsualización (YouTube 16:9, TikTok 9:16, Instagram 1:1, Facebook 4:5, etc.) muestran la imagen real del encuadre en lugar de cajas negras vacías.
   - **Copia física en disco**: FFmpeg genera y almacena automáticamente `[Timestamp]_Master_1080p_Thumbnail.jpg` directamente al lado del archivo `.mp4` dentro de la carpeta del proyecto.

2. **Organización de Grabaciones en Carpeta de Proyectos**:
   - Todas las grabaciones locales se estructuran y archivan automáticamente en `D:\PROGRAMAS IA\PODCASTUDIO\proyectos\[NombreProyecto]\`.
   - El botón de apertura de carpeta redirige de forma precisa al directorio específico del episodio en curso.

3. **Grabación y Transmisión Master Sin Pérdida de Audio**:
   - Prioridad total e ininterrumpida al micrófono maestro (CAM 1 / Micrófono de estudio externo). Los cambios de toma, transiciones y silenciado de altavoces de retorno no interrumpen el audio maestro grabado ni transmitido.
   - Eliminación total del parpadeo negro entre cambios de cámara mediante pre-renderizado continuo en el compositor broadcast.

4. **Consola Remota Optimizada para iPad y Navegadores**:
   - Ajuste responsivo de la interfaz para pantallas de iPad / tabletas sin cortes en botones ni distorsión de controles.
   - Alternancia ágil de cámaras en caliente, modo PiP y control de inicio/parada de grabación sincronizado con la PC.
   - Conexión dinámica de cámaras móviles al primer slot disponible en tiempo real.

5. **Nuevo Binario Nativo `PodcastStudio.exe` v1.0.8.0**:
   - Recompilado con la versión v1.0.8.0, icono original oficial intacto (285 KB) y arranque ultra rápido con sincronización de la ventana splash.
