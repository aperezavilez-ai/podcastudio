# 🔍 DIAGNÓSTICO COMPLETO DEL MOTOR DE VIDEO - PODCASTUDIO

**Fecha**: 2025-01-14  
**Problema**: Video pausado, pixelado y de baja calidad

---

## 🚨 PROBLEMAS IDENTIFICADOS

### **1. imageSmoothingQuality = 'medium'** ❌
**Ubicación**: `src/hooks/useStudioCompositor.js:343`

```javascript
ctx.imageSmoothingQuality = 'medium' // ❌ CAUSA PIXELACIÓN
```

**Problema**: 
- 'medium' causa pixelación visible
- Debe ser 'high' para calidad broadcast

**Solución**:
```javascript
ctx.imageSmoothingQuality = 'high' // ✅ CORREGIDO
```

---

### **2. Constraints de cámara NO optimizados** ⚠️
**Ubicación**: `src/utils/openCamera.js:1-5`

```javascript
const BROADCAST_HD_VIDEO = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 }, // ❌ Solo ideal, no min/max
}
```

**Problema**:
- Sin `min` y `max` frameRate explícitos
- La cámara puede caer a 15fps o menos
- Causa stuttering

**Solución**:
```javascript
const BROADCAST_HD_VIDEO = {
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 30, min: 25, max: 30 }, // ✅ FORZAR 25-30fps
}
```

---

### **3. NO se aplica contentHint='motion' a la cámara** ❌
**Ubicación**: `src/utils/videoStream.js:26-42`

```javascript
export function applyStreamQualityHints(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  if (!track) return

  try {
    track.contentHint = 'motion' // ✅ Está implementado
  } catch { /* noop */ }
  
  try {
    track.applyConstraints({
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, min: 24, max: 60 }, // ⚠️ max: 60 puede causar problemas
    })
  } catch { /* noop */ }
}
```

**Problema**:
- `max: 60` fps permite que la cámara intente 60fps
- Pero `captureStream(30)` solo captura 30fps
- Resultado: frames descartados = stuttering

**Solución**:
```javascript
frameRate: { ideal: 30, min: 25, max: 30 } // ✅ FORZAR 30fps máximo
```

---

### **4. captureStream(30) SIN verificación** ⚠️
**Ubicación**: `src/hooks/useStudioCompositor.js:78, 92, 272, 290`

```javascript
outputStreamRef.current = canvas.captureStream?.(30) || null
```

**Problema**:
- No verifica si captureStream funcionó correctamente
- No aplica contentHint al stream de salida

**Solución**:
```javascript
const stream = canvas.captureStream?.(30) || null
if (stream) {
  const track = stream.getVideoTracks()[0]
  if (track) {
    try {
      track.contentHint = 'motion'
    } catch {}
  }
}
outputStreamRef.current = stream
```

---

### **5. Bitrate de MediaRecorder NO configurado correctamente** ❌
**Ubicación**: `src/hooks/useRecorder.js:121`

```javascript
const mr = new MediaRecorder(stream, { 
  mimeType, 
  videoBitsPerSecond, // ⚠️ Variable, puede ser bajo
  audioBitsPerSecond: 320000 
})
```

**Problema**:
- `videoBitsPerSecond` depende del mimeType
- Para WebM VP9: 8 Mbps (puede ser bajo para 1080p)
- Para MP4 H264: 10 Mbps (correcto)

**Solución**:
```javascript
videoBitsPerSecond: isMp4Recording(mimeType) ? 12_000_000 : 10_000_000
```

---

### **6. Throttle RAF NO es perfecto** ⚠️
**Ubicación**: `src/hooks/useStudioCompositor.js:314-324`

```javascript
const draw = (timestamp) => {
  const elapsed = timestamp - lastFrameTime

  if (elapsed < FRAME_TIME - 1) { // ⚠️ -1 puede causar jitter
    rafRef.current = requestAnimationFrame(draw)
    return
  }

  lastFrameTime = timestamp - (elapsed % FRAME_TIME)
  // ...
}
```

**Problema**:
- `FRAME_TIME - 1` (32.3ms) puede causar micro-stuttering
- La compensación de drift está bien pero puede mejorar

**Solución**:
```javascript
if (elapsed < FRAME_TIME) { // ✅ Sin -1
  rafRef.current = requestAnimationFrame(draw)
  return
}
```

---

## 🎯 PLAN DE CORRECCIÓN

### **Prioridad CRÍTICA** 🔴

1. ✅ Cambiar `imageSmoothingQuality` a 'high'
2. ✅ Forzar frameRate a máximo 30fps en constraints
3. ✅ Aplicar contentHint='motion' al captureStream
4. ✅ Aumentar bitrate de grabación

### **Prioridad ALTA** 🟠

5. ✅ Mejorar throttle RAF (quitar -1)
6. ✅ Verificar que applyStreamQualityHints se llame

### **Prioridad MEDIA** 🟡

7. ✅ Agregar logging de performance
8. ✅ Detectar frame drops automáticamente

---

## 🔧 IMPLEMENTACIÓN

Voy a corregir TODOS estos problemas ahora mismo.

---

**Analista**: Claude Opus 5.5  
**Fecha**: 2025-01-14
