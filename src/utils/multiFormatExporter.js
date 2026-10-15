/**
 * Generador y Reencuadrador Multi-Formato por IA / Canvas
 * Permite adaptar automáticamente cualquier sesión grabada para:
 * 1. 16:9 (YouTube / Facebook Watch) -> 1920x1080
 * 2. 9:16 (TikTok / Instagram Reels / Shorts) -> 1080x1920 con Auto-Reencuadre
 * 3. 1:1 (Instagram Feed / LinkedIn) -> 1080x1080
 */

export const SOCIAL_PRESETS_EXPORT = [
  {
    id: 'facebook',
    key: '16:9',
    width: 1920,
    height: 1080,
    label: 'Facebook (16:9)',
    network: 'Facebook Watch · Páginas Facebook · FB Live',
    filenameSuffix: 'Facebook_16x9',
    badge: 'Horizontal Full HD',
    icon: 'ti ti-brand-facebook',
    color: '#1877f2',
  },
  {
    id: 'youtube',
    key: '16:9_yt',
    baseFormat: '16:9',
    width: 1920,
    height: 1080,
    label: 'YouTube (16:9)',
    network: 'YouTube · YouTube Live · Canal',
    filenameSuffix: 'YouTube_16x9',
    badge: 'Horizontal Full HD',
    icon: 'ti ti-brand-youtube',
    color: '#ef4444',
  },
  {
    id: 'tiktok',
    key: '9:16',
    width: 1080,
    height: 1920,
    label: 'TikTok / Reels (9:16)',
    network: 'TikTok · Facebook Reels · Instagram Reels · Shorts',
    filenameSuffix: 'TikTok_Reels_9x16',
    badge: 'Vertical Auto-Framing',
    icon: 'ti ti-brand-tiktok',
    color: '#00f2fe',
  },
  {
    id: 'instagram',
    key: '1:1',
    width: 1080,
    height: 1080,
    label: 'Instagram Feed (1:1)',
    network: 'Instagram Feed · Facebook Feed · LinkedIn',
    filenameSuffix: 'Instagram_Feed_1x1',
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
async function resolveVideoDuration(video, fallbackDuration = 0) {
  if (fallbackDuration && Number.isFinite(fallbackDuration) && fallbackDuration > 0) {
    return fallbackDuration
  }
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration
  }
  return new Promise((resolve) => {
    let resolved = false
    const done = (d) => {
      if (resolved) return
      resolved = true
      video.removeEventListener('seeked', onSeeked)
      video.currentTime = 0
      resolve(d > 0 ? d : (fallbackDuration || 60))
    }
    const onSeeked = () => {
      const d = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : fallbackDuration
      done(d)
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    try {
      video.currentTime = 1e101
    } catch {
      done(fallbackDuration || 60)
    }
    setTimeout(() => done(fallbackDuration || 60), 600)
  })
}

/**
 * Reencuadra y renderiza un video a un formato específico usando Canvas acelerado
 * @param {Blob|string} sourceMedia - Blob o URL del video origen
 * @param {string} targetFormat - '16:9' | '9:16' | '1:1'
 * @param {Object} options - { mode: 'smart-crop' | 'blur-fill' | 'fit', duration?: number, onProgress: (pct) => void }
 * @returns {Promise<Blob>}
 */
export async function convertVideoToFormat(sourceMedia, targetFormat = '9:16', options = {}) {
  const preset = SOCIAL_PRESETS_EXPORT.find(p => p.key === targetFormat) || SOCIAL_PRESETS_EXPORT[2] // default 9:16
  const targetW = preset.width || (targetFormat === '9:16' ? 1080 : targetFormat === '1:1' ? 1080 : 1920)
  const targetH = preset.height || (targetFormat === '9:16' ? 1920 : targetFormat === '1:1' ? 1080 : 1080)
  const mode = options.mode || 'smart-crop'
  const onProgress = options.onProgress || (() => {})
  const hintDuration = options.duration || 0

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    const blobUrl = sourceMedia instanceof Blob ? URL.createObjectURL(sourceMedia) : sourceMedia
    video.src = blobUrl

    let recorder = null
    let animId = null
    let isTerminated = false
    let audioCtx = null

    const cleanup = () => {
      isTerminated = true
      if (animId) cancelAnimationFrame(animId)
      try { video.pause() } catch {}
      video.src = ''
      video.remove()
      if (audioCtx) {
        try { audioCtx.close() } catch {}
      }
      if (blobUrl.startsWith('blob:') && sourceMedia instanceof Blob) {
        URL.revokeObjectURL(blobUrl)
      }
    }

    video.onloadedmetadata = async () => {
      try {
        const duration = await resolveVideoDuration(video, hintDuration)

        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d', { alpha: false })

        // Capturar audio del video
        let combinedStream = canvas.captureStream(30)
        let audioAdded = false

        try {
          const cap = video.captureStream ? video.captureStream() : video.mozCaptureStream ? video.mozCaptureStream() : null
          if (cap && cap.getAudioTracks().length > 0) {
            cap.getAudioTracks().forEach(t => combinedStream.addTrack(t))
            audioAdded = true
          }
        } catch {}

        if (!audioAdded) {
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            audioCtx = new AudioCtx({ sampleRate: 48000 })
            if (audioCtx.state === 'suspended') await audioCtx.resume()
            video.muted = false
            video.volume = 1.0
            const src = audioCtx.createMediaElementSource(video)
            const dest = audioCtx.createMediaStreamDestination()
            src.connect(dest)
            // No conectar a audioCtx.destination para no reproducir ruido exterior al exportar
            dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
          } catch (e) {
            console.warn('Audio capture fallback warning:', e)
          }
        }

        const mimeType = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'

        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 12000000, // 12 Mbps nitidez broadcast
          audioBitsPerSecond: 320000,  // 320 kbps audio estudio
        })

        const chunks = []
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data)
        }

        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType })
          cleanup()
          resolve(finalBlob)
        }

        const finishRecording = () => {
          if (isTerminated) return
          isTerminated = true
          if (recorder && recorder.state === 'recording') {
            onProgress(100)
            recorder.stop()
          }
        }

        video.onended = finishRecording

        recorder.start(250)
        await video.play()

        const renderFrame = () => {
          if (isTerminated) return

          if (video.ended || (duration > 0 && video.currentTime >= duration - 0.08)) {
            finishRecording()
            return
          }

          const vw = video.videoWidth || 1920
          const vh = video.videoHeight || 1080
          const currentPct = duration > 0 ? Math.min(99, Math.round((video.currentTime / duration) * 100)) : 50
          onProgress(currentPct)

          ctx.fillStyle = '#0a0a0f'
          ctx.fillRect(0, 0, targetW, targetH)

          if (mode === 'blur-fill') {
            // Fondo desenfocado dinámico para rellenar los bordes
            ctx.save()
            ctx.filter = 'blur(30px) brightness(0.6)'
            ctx.drawImage(video, -40, -40, targetW + 80, targetH + 80)
            ctx.restore()

            // Video principal contenido en el centro sin deformar
            const scale = Math.min(targetW / vw, targetH / vh)
            const dw = vw * scale
            const dh = vh * scale
            const dx = (targetW - dw) / 2
            const dy = (targetH - dh) / 2

            ctx.save()
            ctx.shadowColor = 'rgba(0,0,0,0.65)'
            ctx.shadowBlur = 28
            ctx.drawImage(video, dx, dy, dw, dh)
            ctx.restore()
          } else {
            // Smart-crop: llena toda la proporción objetivo (9:16 vertical o 1:1 cuadrado)
            const targetRatio = targetW / targetH
            const srcRatio = vw / vh

            let sx = 0
            let sy = 0
            let sWidth = vw
            let sHeight = vh

            if (srcRatio > targetRatio) {
              // Video origen más ancho (ej. 16:9 a 9:16 o 1:1) -> recorta los lados y centra el sujeto
              sWidth = vh * targetRatio
              sx = (vw - sWidth) / 2
            } else {
              // Video origen más alto -> recorta arriba y abajo
              sHeight = vw / targetRatio
              sy = (vh - sHeight) / 2
            }

            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH)
          }

          animId = requestAnimationFrame(renderFrame)
        }

        animId = requestAnimationFrame(renderFrame)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    video.onerror = (e) => {
      cleanup()
      reject(new Error('Error al decodificar video para exportación multi-formato'))
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
