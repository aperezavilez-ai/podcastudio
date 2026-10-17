import { useEffect, useRef } from 'react'

function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 177, b: 64 }
  const clean = hex.replace('#', '')
  const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/**
 * Conversión RGB -> YCbCr (ITU-R BT.601)
 * El espacio YCbCr separa Luminancia (Y) de Crominancia (Cb, Cr).
 * Esto permite eliminar el fondo verde/azul calculando distancia únicamente
 * en el plano de color (Cb, Cr), volviéndolo inmune a sombras, arrugas y gradientes
 * de luz en la tela física (algoritmo gc-films.com / eugeneteoh chromakey).
 */
function rgbToYCbCr(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return { y, cb, cr }
}

/**
 * Algoritmo profesional de Chroma Key en espacio YCbCr (gc-films.com / broadcast standard)
 * - Soporte dual ultra-preciso (Verde `#00b140`, Azul `#0047bb` o personalizado)
 * - Tolerancia doble (tola y tolb) con transición suave de bordes anti-aliasing
 * - Supresión de desborde de color (Despill) en cabello, ropa y hombros
 * - Recorte de bordes de grabación (cropLeft, cropRight, cropTop, cropBottom) para eliminar paredes sin tela
 */
export function applyChromaKey(
  imageData,
  keyColor = '#00b140',
  similarity = 40,
  smoothness = 25,
  despill = 50,
  crop = { left: 0, right: 0, top: 0, bottom: 0 }
) {
  const { r: kr, g: kg, b: kb } = hexToRgb(keyColor)
  const { cb: keyCb, cr: keyCr } = rgbToYCbCr(kr, kg, kb)
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height

  // Límites de recorte del área de grabación (en píxeles)
  const minX = Math.round((crop.left || 0) * 0.01 * width)
  const maxX = Math.round(width * (1 - (crop.right || 0) * 0.01))
  const minY = Math.round((crop.top || 0) * 0.01 * height)
  const maxY = Math.round(height * (1 - (crop.bottom || 0) * 0.01))

  // Umbrales tola y tolb en distancia cromática YCbCr (0 .. 180 aprox.)
  // similarity (10..90) -> tola (15..110)
  const tola = (similarity / 100) * 105 + 10
  // smoothness (5..60) -> tolb = tola + smoothRange
  const smoothRange = Math.max(3, (smoothness / 100) * 55)
  const tolb = tola + smoothRange

  const despillFactor = Math.max(0, Math.min(100, despill)) / 100
  const isGreenKey = kg > kr * 1.15 && kg > kb * 1.15
  const isBlueKey = kb > kr * 1.15 && kb > kg * 1.15

  const len = data.length
  for (let i = 0; i < len; i += 4) {
    const pixelIdx = i / 4
    const x = pixelIdx % width
    const y = Math.floor(pixelIdx / width)

    // 1. Recorte de área de grabación (Crop): eliminar objetos fuera de la tela verde
    if (x < minX || x >= maxX || y < minY || y >= maxY) {
      data[i + 3] = 0 // Transparente fuera del área de grabación
      continue
    }

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // 2. Distancia euclidiana en el plano cromático Cb-Cr
    const { cb, cr } = rgbToYCbCr(r, g, b)
    const dCb = cb - keyCb
    const dCr = cr - keyCr
    const dist = Math.sqrt(dCb * dCb + dCr * dCr)

    // Condición adicional de seguridad: canal verde/azul dominante para evitar falsos positivos
    let isKeyCandidate = false
    if (isGreenKey) {
      isKeyCandidate = g > r * 0.88 && g > b * 0.88
    } else if (isBlueKey) {
      isKeyCandidate = b > r * 0.88 && b > g * 0.88
    } else {
      isKeyCandidate = true
    }

    if (isKeyCandidate && dist < tolb) {
      if (dist <= tola) {
        // Fondo 100% puro
        data[i + 3] = 0
      } else {
        // Transición suave / matte gradual (gc-films hermite smoothstep)
        const t = (dist - tola) / smoothRange
        const smoothAlpha = t * t * (3 - 2 * t)
        data[i + 3] = Math.round(smoothAlpha * 255)
      }
    }

    // 3. Supresión de rebote (Despill) sobre la persona en píxeles visibles
    if (data[i + 3] > 0 && despillFactor > 0) {
      if (isGreenKey) {
        const avgOther = 0.5 * (r + b)
        if (g > avgOther) {
          data[i + 1] = Math.round(g * (1 - despillFactor) + avgOther * despillFactor)
        }
      } else if (isBlueKey) {
        const avgOther = 0.5 * (r + g)
        if (b > avgOther) {
          data[i + 2] = Math.round(b * (1 - despillFactor) + avgOther * despillFactor)
        }
      }
    }
  }
}

export function useChromaKeyCanvas(
  videoRef,
  {
    enabled,
    keyColor = '#00b140',
    similarity = 40,
    smoothness = 25,
    despill = 50,
    crop = { left: 0, right: 0, top: 0, bottom: 0 },
  }
) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const video = videoRef?.current
    const canvas = canvasRef.current
    if (!video || !canvas || !enabled) return undefined

    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        ctx.drawImage(video, 0, 0)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        applyChromaKey(frame, keyColor, similarity, smoothness, despill, crop)
        ctx.putImageData(frame, 0, 0)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [videoRef, enabled, keyColor, similarity, smoothness, despill, crop])

  return canvasRef
}
