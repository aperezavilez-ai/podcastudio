# 🚀 PodcaStudio v1.0.10 — Ultra Calidad 1080p, Mando iPad & Proyectos Limpios

Fecha de Release: 25 de Octubre, 2026  
Ejecutable: `PodcastStudio.exe` (v1.0.10.0)  
Plataforma: Windows (Electron + .NET Launcher)  
Servicio Cloud / Mando: `https://www.podcastudio.mx`

---

## 🌟 Novedades y Correcciones Principales

### 1. Calidad de Video 1080p Prístina y Eliminación de Tartamudeo
- **Captura a 1080p**: `getUserMedia` configurado con resolución Full HD ideal (1920x1080 a 30fps) para asegurar que el zoom dinámico mantenga nitidez sin pixelarse.
- **Tasa de bits Master**: Aumentada la tasa de bits de grabación en canvas a 10 Mbps (10,000,000 bps) con audio AAC de 192 kbps.
- **Parámetros FFmpeg Broadcast**:
  - Eliminado `-tune zerolatency` (causante de pixelado y macrobloques por omitir B-frames).
  - Configurado `-crf 17` y cadencia GOP regular `-g 60 -keyint_min 30` para eliminar pausas y tartamudeo en reproductores multimedia locales.

### 2. Zoom Dinámico y Encuadre Suave (Cero Brincos)
- Eliminado el salto brusco a 1.25x en clic de ratón.
- Unificado el centro de transformación (`50% 50%`) y la combinación continua de arrastre y zoom (`translate3d + scale`), permitiendo centrar la toma como si fuera una ventana de Windows con respuesta inmediata y sin sobresaltos.

### 3. Visibilidad y Acceso al Mando iPad / Tablet
- **Barra Superior**: Botón `[ 🎮 Mando iPad ]` siempre visible y destacado en tono ámbar brillante.
- **Modal de Conexión de Cámaras**: Nueva pestaña dedicada `🎮 Mando iPad / Switcher` con código QR, enlace y pasos para conectar el iPad.
- **Banner en Pestaña QR Móvil**: Banner explicativo para no confundir la cámara de celular con el switcher remoto.
- **Barra Lateral Derecha**: Botón directo `[ 🎮 Mando iPad (Switcher) ]` accesible en todo momento.

### 4. Estructura Limpia en Carpeta Raíz de Proyectos (Cero Duplicados)
- Todos los videos (Master, miniatura y recortes multi-formato para redes) se guardan directamente en `D:\PROGRAMAS IA\PODCASTUDIO\proyectos\[NombreProyecto]\`.
- Eliminada la duplicación de carpetas generadas con timestamps o prefijos.
- Suprimidos los molestos diálogos del navegador "Guardar como...": la escritura es silenciosa y directa en disco. Al pulsar "Abrir Carpeta", se abre directamente el Explorador de Windows en la carpeta del proyecto.
