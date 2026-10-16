import { useEffect, useRef } from 'react'

function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 177, b: 64 }
  const clean = hex.replace('#', '')
  const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/**
 * Algoritmo profesional de Chroma Key con soporte dual (Pantalla Verde y Pantalla Azul)
 * y supresión de rebote de luz (Despill) para eliminar halos en pelo y hombros.
 */
function applyChromaKey(imageData, keyColor = '#00b140', similarity = 40, smoothness = 25, despill = 50) {
  const { r: kr, g: kg, b: kb } = hexToRgb(keyColor)
  const data = imageData.data
  const thresh = (similarity / 100) * 255
  const smooth = Math.max(0.01, smoothness / 100)
  const despillFactor = Math.max(0, Math.min(100, despill)) / 100

  // Detectar modo predominante del color clave
  const isGreenKey = kg > kr * 1.15 && kg > kb * 1.15
  const isBlueKey = kb > kr * 1.15 && kb > kg * 1.15

  const len = data.length
  for (let i = 0; i < len; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Distancia euclidiana al color clave
    const dr = r - kr
    const dg = g - kg
    const db = b - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    let isMatch = false
    if (isGreenKey) {
      // Pantalla Verde: el canal verde debe ser dominante y estar cerca del umbral
      isMatch = g > r * 1.05 && g > b * 1.05 && dist < thresh
    } else if (isBlueKey) {
      // Pantalla Azul: el canal azul debe ser dominante y estar cerca del umbral
      isMatch = b > r * 1.05 && b > g * 1.05 && dist < thresh
    } else {
      // Color personalizado genérico
      isMatch = dist < thresh
    }

    if (isMatch) {
      const edge = thresh * (1 - smooth * 0.5)
      if (dist < edge) {
        data[i + 3] = 0 // Totalmente transparente
      } else {
        // Borde suavizado anti-aliasing
        data[i + 3] = Math.round(((dist - edge) / (thresh - edge)) * 255)
      }
    } else if (despillFactor > 0) {
      // Supresión de rebote (Despill): limpia el halo verde o azul reflejado en piel y ropa
      if (isGreenKey && g > r && g > b) {
        const maxRB = Math.max(r, b)
        data[i + 1] = Math.round(g * (1 - despillFactor) + maxRB * despillFactor)
      } else if (isBlueKey && b > r && b > g) {
        const maxRG = Math.max(r, g)
        data[i + 2] = Math.round(b * (1 - despillFactor) + maxRG * despillFactor)
      }
    }
  }
}

export function useChromaKeyCanvas(videoRef, { enabled, keyColor = '#00b140', similarity = 40, smoothness = 25, despill = 50 }) {
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
        applyChromaKey(frame, keyColor, similarity, smoothness, despill)
        ctx.putImageData(frame, 0, 0)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [videoRef, enabled, keyColor, similarity, smoothness, despill])

  return canvasRef
}

export { applyChromaKey, hexToRgb }

