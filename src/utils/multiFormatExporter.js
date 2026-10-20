/**
 * Generador y Reencuadrador Multi-Formato por IA / Canvas
 * Permite adaptar automáticamente cualquier sesión grabada para:
 * 1. 16:9 (YouTube / Facebook Watch) -> 1920x1080
 * 2. 9:16 (TikTok / Instagram Reels / Shorts) -> 1080x1920 con Auto-Reencuadre
 * 3. 1:1 (Instagram Feed / LinkedIn) -> 1080x1080
 */

import { fixWebmDuration } from './fixWebmDuration.js'

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
    // Elemento visible en DOM fuera de pantalla para que Chromium decodifique 100% de los fotogramas
    video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:640px;height:360px;opacity:0.99;pointer-events:none;z-index:-9999;'
    document.body.appendChild(video)
    const blobUrl = sourceMedia instanceof Blob ? URL.createObjectURL(sourceMedia) : sourceMedia
    video.src = blobUrl

    let recorder = null
    let animId = null
    let intervalId = null
    let isTerminated = false
    let audioCtx = null

    const cleanup = () => {
      isTerminated = true
      if (animId) cancelAnimationFrame(animId)
      if (intervalId) clearInterval(intervalId)
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
        const is4K = (options.quality === '4k') || (video.videoWidth >= 2500)
        const finalW = is4K ? (targetFormat === '9:16' ? 2160 : targetFormat === '1:1' ? 2160 : 3840) : targetW
        const finalH = is4K ? (targetFormat === '9:16' ? 3840 : targetFormat === '1:1' ? 2160 : 2160) : targetH
        const exportBitrate = is4K ? 35000000 : 12000000

        const canvas = document.createElement('canvas')
        canvas.width = finalW
        canvas.height = finalH
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
            dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
          } catch (e) {
            console.warn('Audio capture fallback warning:', e)
          }
        }

        const mimeType = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'

        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: exportBitrate,
          audioBitsPerSecond: 320000,
        })

        const chunks = []
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data)
        }

        if (options.abortSignal) {
          options.abortSignal.addEventListener('abort', () => {
            finishRecording()
            cleanup()
            reject(new Error('Exportación cancelada'))
          })
        }

        recorder.onstop = async () => {
          let rawBlob = new Blob(chunks, { type: mimeType })
          if (!mimeType.includes('mp4')) {
            const durMs = Math.max(1000, Math.round((duration || hintDuration || 1) * 1000))
            try {
              rawBlob = await fixWebmDuration(rawBlob, durMs)
            } catch (e) {
              console.warn('[multiFormatExporter] fixWebmDuration warning:', e)
            }
          }
          cleanup()
          resolve(rawBlob)
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

        // Dibujar primer frame en el lienzo antes de arrancar para evitar pantalla blanca inicial
        try {
          await video.play()
        } catch {
          video.muted = true
          await video.play().catch(() => {})
        }

        const drawFrame = () => {
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
          ctx.fillRect(0, 0, finalW, finalH)

          if (mode === 'blur-fill') {
            // Fondo desenfocado dinámico para rellenar los bordes
            ctx.save()
            ctx.filter = 'blur(30px) brightness(0.6)'
            ctx.drawImage(video, -40, -40, finalW + 80, finalH + 80)
            ctx.restore()

            // Video principal contenido en el centro sin deformar
            const scale = Math.min(finalW / vw, finalH / vh)
            const dw = vw * scale
            const dh = vh * scale
            const dx = (finalW - dw) / 2
            const dy = (finalH - dh) / 2

            ctx.save()
            ctx.shadowColor = 'rgba(0,0,0,0.65)'
            ctx.shadowBlur = 28
            ctx.drawImage(video, dx, dy, dw, dh)
            ctx.restore()
          } else {
            // Smart-crop: llena toda la proporción objetivo (9:16 vertical o 1:1 cuadrado)
            const targetRatio = finalW / finalH
            const srcRatio = vw / vh

            let sx = 0
            let sy = 0
            let sWidth = vw
            let sHeight = vh

            if (srcRatio > targetRatio) {
              sWidth = vh * targetRatio
              sx = (vw - sWidth) / 2
            } else {
              sHeight = vw / targetRatio
              sy = (vh - sHeight) / 2
            }

            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, finalW, finalH)
          }
        }

        drawFrame()
        recorder.start(100)

        const renderLoop = () => {
          if (isTerminated) return
          drawFrame()
          animId = requestAnimationFrame(renderLoop)
        }

        animId = requestAnimationFrame(renderLoop)
        intervalId = setInterval(() => {
          if (!isTerminated) drawFrame()
        }, 33)
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
export function buildFormatFilename(baseName, formatKey, ext = 'mp4') {
  const cleanBase = (baseName || 'Episodio').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const preset = SOCIAL_PRESETS_EXPORT.find(p => p.key === formatKey)
  const suffix = preset ? preset.filenameSuffix : formatKey.replace(':', 'x')
  return `${cleanBase}_${suffix}.${ext}`
}
