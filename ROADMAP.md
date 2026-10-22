# 🗺️ ROADMAP OFICIAL — PODCASTSTUDIO

Documento maestro de desarrollo, hitos alcanzados y próximas fases del estudio broadcast.

---

## 🚨 URGENTE & PRIORIDAD ALTA — En Optimización Activa
1. **Cámara Remota Móvil — Latencia Cero (Eliminar retraso de 2 segundos)**:
   - Configuración de buffer de reproducción nulo (`playoutDelayHint = 0` y `jitterBufferTarget = 0`) en el receptor WebRTC.
   - Reducción del jitter buffer dinámico para transmisión en tiempo real sin latencia perceptible.
2. **Cámara Remota Móvil — Eliminación de Pixelado en Movimiento**:
   - Incremento del bitrate dinámico de 2.5 Mbps a 4.5–6 Mbps Full HD.
   - Política de codificación `maintain-resolution` para evitar macrobloques o degradación de calidad ante movimientos rápidos del conductor.
   - Ajuste de SDP con `x-google-min-bitrate` y perfil H.264 baseline de latencia ultra-baja.

---

## 🚀 Versión Actual: v1.0.1 (Producción Oficial)
- **Marco de Ventana Broadcast**: Barra de título 100% negra (`#0a0a0a`) nativa de Windows integrada con la cabecera.
- **Identidad Oficial Limpia**: Logo vectorial oficial de PodcastStudio (sin duplicados ni imágenes rotas).
- **Control de Cámaras**: Botón de bote de basura (`Trash2`) en todas las ranuras para apagar señales activas y eliminar ranuras libres.
- **Delimitación de Estudio**: Barra inferior con versión activa y telemetría de emisión en tiempo real.
- **Compilación Nativa**: `PodcastStudio.exe` v1.0.1 optimizado en la raíz con icono oficial y arranque en milisegundos.
- **Arranque Instantáneo**: Eliminación de pantalla negra mediante `ready-to-show` y renderizado de branding inmediato.
- **Monitor Master Limpio**: Área de video libre de indicadores flotantes y botón de **Cuadrícula de Encuadre (Regla de Tercios)** activable/desactivable en Master.
- **Grabación y Exportación Multi-Formato**: Contador de grabación en vivo con temporizador y apertura automática del panel de descarga multi-red (YouTube 16:9, Facebook, TikTok 9:16 e Instagram 1:1) junto con portadas oficiales.

---

## 🎯 Próximos Hitos (v1.1.0)
- [ ] Soporte para balance de blancos manual y controles ISO remotos desde la PC.
- [ ] Integración de selector multicámara con tally light físico (vía USB/Serial).
- [ ] Banco de efectos de sonido con disparadores por atajos de teclado numérico (Numpad).
- [ ] Auto-detección de encuadre facial por IA en el corte vertical para TikTok y Reels.

---

## 🌟 Visión a Largo Plazo (v2.0.0)
- SFU Cloud Distribuido para producción de paneles de debate con hasta 16 invitados remotos simultáneos.
- Transcripción en vivo generada por IA para subtítulos automáticos en tiempo real.
- Switcher inteligente asistido por detección de voz para alternar cámaras de forma autónoma.
