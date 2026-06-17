import { useEffect, useRef } from 'react'

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function applyChromaKey(imageData, keyColor, similarity, smoothness) {
  const { r: kr, g: kg, b: kb } = hexToRgb(keyColor)
  const data = imageData.data
  const thresh = (similarity / 100) * 255
  const smooth = smoothness / 100

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const dr = r - kr
    const dg = g - kg
    const db = b - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    const greenDominant = g > r * 1.1 && g > b * 1.1
    if (greenDominant && dist < thresh) {
      const edge = thresh * (1 - smooth * 0.5)
      data[i + 3] = dist < edge ? 0 : Math.round(((dist - edge) / (thresh - edge)) * 255)
    }
  }
}

export function useChromaKeyCanvas(videoRef, { enabled, keyColor, similarity, smoothness }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !enabled) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        ctx.drawImage(video, 0, 0)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        applyChromaKey(frame, keyColor, similarity, smoothness)
        ctx.putImageData(frame, 0, 0)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [videoRef, enabled, keyColor, similarity, smoothness])

  return canvasRef
}

export { applyChromaKey }
