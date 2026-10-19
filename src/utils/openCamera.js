// Perfil broadcast 1080p con preferencias flexibles para máxima compatibilidad con cualquier webcam
const BROADCAST_HD_VIDEO = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 60 },
}

// Perfil fluido 720p estándar (compatible con webcams integradas de laptop)
const FLUID_720P_VIDEO = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 60 },
}

export function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function openCameraStreamFacing(facingMode, withAudio = true) {
  const videoAttempts = [
    { facingMode: { ideal: facingMode }, ...BROADCAST_HD_VIDEO },
    { facingMode: { ideal: facingMode }, ...FLUID_720P_VIDEO },
    { facingMode: { exact: facingMode } },
    { facingMode: { ideal: facingMode } },
    { facingMode },
    true,
  ]

  if (withAudio) {
    for (const video of videoAttempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        })
      } catch {}
    }
  }

  let lastError = null
  for (const video of videoAttempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false })
    } catch (e) {
      lastError = e
    }
  }

  throw lastError || new Error('No se pudo abrir la cámara móvil')
}

/**
 * Abre el flujo de una cámara USB o integrada con múltiples niveles de fallback
 * y tolerancia a bloqueos temporales de Windows Media Foundation.
 */
export async function openCameraStream(deviceId, withAudio = false) {
  const videoAttempts = []

  if (deviceId) {
    // 1. Intento óptimo HD con ID exacto
    videoAttempts.push({ deviceId: { exact: deviceId }, ...BROADCAST_HD_VIDEO })
    // 2. Intento 720p con ID exacto (el más común en EasyCamera / laptops)
    videoAttempts.push({ deviceId: { exact: deviceId }, ...FLUID_720P_VIDEO })
    // 3. Intento sin restricción de resolución con ID exacto
    videoAttempts.push({ deviceId: { exact: deviceId } })
    // 4. Intento con ID ideal
    videoAttempts.push({ deviceId: { ideal: deviceId }, ...FLUID_720P_VIDEO })
    videoAttempts.push({ deviceId: { ideal: deviceId } })
    videoAttempts.push({ deviceId })
  }

  // 5. Fallbacks genéricos si el deviceId fue reasignado por el sistema
  videoAttempts.push({ ...BROADCAST_HD_VIDEO })
  videoAttempts.push({ ...FLUID_720P_VIDEO })
  videoAttempts.push(true)

  // Intentar con audio si se solicitó explícitamente
  if (withAudio) {
    for (const video of videoAttempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        })
      } catch {}
    }
  }

  // Flujo principal de video (más confiable y sin colisión con micrófonos de Windows)
  let lastError = null
  for (const video of videoAttempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false })
    } catch (e) {
      lastError = e
      // Si Windows Media Foundation informa que el hardware está ocupado, esperar 300ms y reintentar
      if (e?.name === 'NotReadableError' || e?.name === 'AbortError') {
        await waitMs(300)
        try {
          return await navigator.mediaDevices.getUserMedia({ video, audio: false })
        } catch {}
      }
    }
  }

  throw lastError || new Error('No se pudo abrir la cámara')
}
