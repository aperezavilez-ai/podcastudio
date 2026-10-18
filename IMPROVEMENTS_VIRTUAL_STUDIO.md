# Mejoras implementadas en Escenarios Virtuales + Chroma / IA Cutout

## Cambios realizados

1. **`src/utils/drawSetBackground.js`**
   - Añadido soporte real para **video loops** de los templates.
   - Nueva función `getCachedVideo` que crea elementos `<video>` ocultos, en loop y muted.
   - `drawSetBackground` ahora prefiere dibujar el video loop cuando existe (`tmpl.video`) en lugar de la imagen estática.
   - Fallback automático a la imagen JPG si el video aún no está listo.

2. **`src/utils/canvasCompositor.js`**
   - La llamada a `drawSetBackground` ahora respeta `background.liveMotionEnabled` (si existe).

3. **`src/config/backgroundTemplates.js`**
   - Descripciones actualizadas para indicar que son sets con video loop realista.
   - Añadido flag `liveVideo: true` en todos los templates con video.

## Resultado

Los escenarios virtuales (Noticias, Talk Show, Keynote, Cyber Tech, Concierto) ahora usan los archivos `.mp4` en loop de `public/sets/` durante el preview y la grabación, en lugar de solo las fotos estáticas.

## Próximos pasos recomendados (no incluidos en este paquete)

- Reemplazar los videos actuales (bitrate ~250 kbps, 8 s) por loops de mayor calidad (2–6 Mbps, 10–20 s, con movimiento sutil realista).
- Integrar **Robust Video Matting (RVM)** vía ONNX Runtime Web como motor de recorte de personas de mayor calidad (mejor pelo y estabilidad temporal que MediaPipe).
- Añadir más templates y opción de subida de video personalizado de alta calidad.
- Mejorar el matching de iluminación entre el presentador y el set.

## Cómo aplicar

1. Copia los archivos modificados sobre tu repositorio local.
2. Asegúrate de que `public/sets/*.mp4` estén presentes.
3. `npm install && npm run dev`.

Los videos ya existentes se activan automáticamente.
