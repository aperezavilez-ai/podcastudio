/**
 * Generador Automático de Miniaturas Multi-Red para PODCASTUDIO
 * Extrae fotogramas en alta resolución del video grabado o del canvas
 * y genera las portadas oficiales para YouTube, Facebook, Instagram y TikTok.
 */

export const SOCIAL_THUMBNAIL_PRESETS = [
  {
    id: 'youtube',
    network: 'YouTube',
    label: 'Miniatura YouTube',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    badge: '1280 × 720',
    icon: 'ti ti-brand-youtube',
    color: '#ef4444',
    suffix: 'miniatura-youtube-16x9',
  },
  {
    id: 'facebook',
    network: 'Facebook',
    label: 'Portada Facebook',
    width: 1200,
    height: 630,
    aspectRatio: '1.91:1',
    badge: '1200 × 630',
    icon: 'ti ti-brand-facebook',
    color: '#1877f2',
    suffix: 'portada-facebook-banner',
  },
  {
    id: 'instagram',
    network: 'Instagram',
    label: 'Portada Instagram Feed / Reels',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badge: '1080 × 1080',
    icon: 'ti ti-brand-instagram',
    color: '#e1306c',
    suffix: 'portada-instagram-1x1',
  },
  {
    id: 'tiktok',
    network: 'TikTok / Shorts',
    label: 'Portada TikTok / Shorts',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    badge: '1080 × 1920',
    icon: 'ti ti-brand-tiktok',
    color: '#00f2fe',
    suffix: 'portada-tiktok-9x16',
  },
]

/**
 * Extrae un fotograma del video en un segundo determinado
 * @param {Blob|string} sourceMedia - Blob del video o URL
 * @param {number} seekTimeSec - Segundo de captura (default 2s para evitar negro inicial)
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureVideoFrame(sourceMedia, seekTimeSec = 2) {
  if (sourceMedia instanceof HTMLCanvasElement) {
    return sourceMedia;
  }
  if (sourceMedia && typeof sourceMedia === 'object' && sourceMedia.snapshotCanvas instanceof HTMLCanvasElement) {
    return sourceMedia.snapshotCanvas;
  }
  if (sourceMedia && typeof sourceMedia === 'object' && sourceMedia.thumbnailDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 1920;
        c.height = img.naturalHeight || 1080;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = () => reject(new Error('Error al procesar miniatura base64'));
      img.src = sourceMedia.thumbnailDataUrl;
    });
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = true
    video.preload = 'auto'

    const mediaObj = (sourceMedia && sourceMedia.blob) ? sourceMedia.blob : ((sourceMedia && sourceMedia.url) ? sourceMedia.url : sourceMedia)
    const blobUrl = mediaObj instanceof Blob ? URL.createObjectURL(mediaObj) : mediaObj
    video.src = blobUrl

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      if (mediaObj instanceof Blob) {
        URL.revokeObjectURL(blobUrl)
      }
      try { video.pause() } catch {}
      video.src = ''
      video.remove()
    }

    const onSeeked = () => {
      if (cleaned) return
      try {
        const vw = video.videoWidth || 1920
        const vh = video.videoHeight || 1080
        const canvas = document.createElement('canvas')
        canvas.width = vw
        canvas.height = vh
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, vw, vh)
        cleanup()
        resolve(canvas)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    const onLoadedMetadata = () => {
      const duration = video.duration || 10
      // Capturar al segundo solicitado o al 15% de la sesión si es menor
      const targetTime = Math.min(Math.max(0.5, seekTimeSec), Math.max(0.5, duration * 0.15))
      try {
        video.currentTime = targetTime
      } catch {
        onSeeked()
      }
    }

    const onLoadedData = () => {
      // Respaldo de seguridad si seeked no dispara en WebM
      setTimeout(() => {
        if (!cleaned && video.readyState >= 2) {
          onSeeked()
        }
      }, 1200)
    }

    const onError = (e) => {
      cleanup()
      reject(new Error('No se pudo cargar el video para generar la miniatura'))
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
    video.addEventListener('loadeddata', onLoadedData, { once: true })
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })

    // Timeout de seguridad en caso de fallo de códec
    setTimeout(() => {
      if (!cleaned) {
        if (video.readyState >= 2) {
          onSeeked()
        } else {
          cleanup()
          reject(new Error('Timeout extrayendo fotograma del video'))
        }
      }
    }, 6000)
  })
}

/**
 * Genera una miniatura recortada y ajustada con centrado inteligente
 * @param {HTMLCanvasElement} sourceCanvas - Fotograma fuente
 * @param {Object} preset - Configuración del preset de red social
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function renderPresetThumbnail(sourceCanvas, preset) {
  const { width: tw, height: th } = preset
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const sw = sourceCanvas.width
  const sh = sourceCanvas.height
  const targetRatio = tw / th
  const sourceRatio = sw / sh

  let sx = 0
  let sy = 0
  let sWidth = sw
  let sHeight = sh

  if (sourceRatio > targetRatio) {
    // Fuente más ancha que el destino (recorte horizontal centrado)
    sWidth = Math.round(sh * targetRatio)
    sx = Math.round((sw - sWidth) / 2)
  } else {
    // Fuente más alta que el destino (recorte vertical centrado)
    sHeight = Math.round(sw / targetRatio)
    sy = Math.round((sh - sHeight) / 2)
  }

  // 1. Fondo suave o difuminado si es necesario
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, tw, th)

  // 2. Dibujar imagen reencuadrada en alta definición
  ctx.drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, tw, th)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
      resolve({ blob, dataUrl })
    }, 'image/jpeg', 0.95)
  })
}

/**
 * Genera el paquete completo de las 4 miniaturas para redes sociales
 * @param {Blob|string} sourceMedia - Video grabado
 * @param {string} baseName - Nombre base del archivo
 * @returns {Promise<Array>} Lista de miniaturas listas para descargar
 */
export async function generateAllSocialThumbnails(sourceMedia, baseName = 'episodio') {
  const sourceFrameCanvas = await captureVideoFrame(sourceMedia)
  const cleanBase = baseName.replace(/\.(webm|mp4)$/i, '')

  const results = []
  for (const preset of SOCIAL_THUMBNAIL_PRESETS) {
    const { blob, dataUrl } = await renderPresetThumbnail(sourceFrameCanvas, preset)
    results.push({
      ...preset,
      blob,
      dataUrl,
      filename: `${cleanBase}-${preset.suffix}.jpg`,
    })
  }

  return results
}

/**
 * Descarga una miniatura al sistema del usuario
 * @param {Object} thumb - Objeto de miniatura con blob y filename
 */
export function downloadThumbnailFile(thumb) {
  if (!thumb || !thumb.blob) return
  const url = URL.createObjectURL(thumb.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = thumb.filename || `miniatura-${thumb.id || 'red'}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
