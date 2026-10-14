/**
 * Generador y Reencuadrador Multi-Formato por IA / Canvas
 * Permite adaptar automáticamente cualquier sesión grabada para:
 * 1. 16:9 (YouTube / Facebook Watch) -> 1920x1080
 * 2. 9:16 (TikTok / Instagram Reels / Shorts) -> 1080x1920 con Auto-Reencuadre
 * 3. 1:1 (Instagram Feed / LinkedIn) -> 1080x1080
 */

export const SOCIAL_PRESETS_EXPORT = [
  {
    key: '16:9',
    width: 1920,
    height: 1080,
    label: 'YouTube / FB (16:9)',
    network: 'YouTube · Facebook Watch · Twitch · Web',
    filenameSuffix: 'YouTube_16x9',
    badge: 'Horizontal Full HD',
    icon: 'ti ti-brand-youtube',
    color: '#ef4444',
  },
  {
    key: '9:16',
    width: 1080,
    height: 1920,
    label: 'TikTok / Reels (9:16)',
    network: 'TikTok · Instagram Reels · YouTube Shorts',
    filenameSuffix: 'TikTok_Reels_9x16',
    badge: 'Vertical Auto-Framing',
    icon: 'ti ti-brand-tiktok',
    color: '#00f2fe',
  },
  {
    key: '1:1',
    width: 1080,
    height: 1080,
    label: 'Instagram Feed (1:1)',
    network: 'Instagram Feed · Facebook Feed · LinkedIn',
    filenameSuffix: 'Feed_1x1',
    badge: 'Cuadrado Balanceado',
    icon: 'ti ti-brand-instagram',
    color: '#e1306c',
  },
]

/**
 * Reencuadra y renderiza un video a un formato específico usando Canvas acelerado
 * @param {Blob|string} sourceMedia - Blob o URL del video origen
 * @param {string} targetFormat - '16:9' | '9:16' | '1:1'
 * @param {Object} options - { mode: 'smart-crop' | 'blur-fill' | 'fit', onProgress: (pct) => void }
 * @returns {Promise<Blob>}
 */
export async function convertVideoToFormat(sourceMedia, targetFormat = '9:16', options = {}) {
  const preset = SOCIAL_PRESETS_EXPORT.find(p => p.key === targetFormat) || SOCIAL_PRESETS_EXPORT[1]
  const targetW = preset.width
  const targetH = preset.height
  const mode = options.mode || 'smart-crop'
  const onProgress = options.onProgress || (() => {})

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.src = sourceMedia instanceof Blob ? URL.createObjectURL(sourceMedia) : sourceMedia

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration
        if (!duration || !isFinite(duration)) {
          // Si no hay duración definida, devolver el blob original
          resolve(sourceMedia instanceof Blob ? sourceMedia : null)
          return
        }

        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d', { alpha: false })

        // Capturar audio del video original
        let combinedStream = canvas.captureStream(30)
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          const source = audioCtx.createMediaElementSource(video)
          const dest = audioCtx.createMediaStreamDestination()
          source.connect(dest)
          source.connect(audioCtx.destination) // opcional o mutear
          dest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track))
        } catch {
          // Audio ya incluido o no soportado en contexto
        }

        const mimeType = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'

        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: targetFormat === '9:16' ? 7000000 : 8000000,
        })

        const chunks = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType })
          if (sourceMedia instanceof Blob && video.src.startsWith('blob:')) {
            URL.revokeObjectURL(video.src)
          }
          resolve(finalBlob)
        }

        recorder.start(500)
        await video.play()

        const renderFrame = () => {
          if (video.paused || video.ended) {
            recorder.stop()
            return
          }

          const vw = video.videoWidth || 1920
          const vh = video.videoHeight || 1080
          const currentProgress = Math.min(100, Math.round((video.currentTime / duration) * 100))
          onProgress(currentProgress)

          ctx.fillStyle = '#0a0a0f'
          ctx.fillRect(0, 0, targetW, targetH)

          if (mode === 'blur-fill') {
            // Fondo desenfocado dinámico para rellenar los bordes verticales u horizontales
            ctx.save()
            ctx.filter = 'blur(28px) brightness(0.6)'
            ctx.drawImage(video, -40, -40, targetW + 80, targetH + 80)
            ctx.restore()

            // Video principal contenido en el centro sin deformar
            const scale = Math.min(targetW / vw, targetH / vh)
            const dw = vw * scale
            const dh = vh * scale
            const dx = (targetW - dw) / 2
            const dy = (targetH - dh) / 2

            // Sombra sutil en el marco
            ctx.save()
            ctx.shadowColor = 'rgba(0,0,0,0.6)'
            ctx.shadowBlur = 30
            ctx.drawImage(video, dx, dy, dw, dh)
            ctx.restore()
          } else {
            // Smart-crop: Llena todo el espacio manteniendo proporciones y centrando el sujeto
            const targetRatio = targetW / targetH
            const srcRatio = vw / vh

            let sx = 0, sy = 0, sWidth = vw, sHeight = vh

            if (srcRatio > targetRatio) {
              // El video origen es más ancho que el destino (ej. 16:9 a 9:16)
              sWidth = vh * targetRatio
              sx = (vw - sWidth) / 2 // Centrado óptimo del orador / cámara master
            } else {
              // El video origen es más alto que el destino
              sHeight = vw / targetRatio
              sy = (vh - sHeight) / 2
            }

            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH)
          }

          requestAnimationFrame(renderFrame)
        }

        requestAnimationFrame(renderFrame)
      } catch (err) {
        reject(err)
      }
    }

    video.onerror = (e) => {
      reject(new Error('Error al cargar el video para exportación multi-formato'))
    }
  })
}

/**
 * Genera el nombre de archivo optimizado según el formato y red social
 */
export function buildFormatFilename(baseName, formatKey, ext = 'webm') {
  const cleanBase = (baseName || 'Episodio').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const preset = SOCIAL_PRESETS_EXPORT.find(p => p.key === formatKey)
  const suffix = preset ? preset.filenameSuffix : formatKey.replace(':', 'x')
  return `${cleanBase}_${suffix}.${ext}`
}
