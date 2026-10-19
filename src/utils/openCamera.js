// Perfil broadcast 1080p con preferencias flexibles para máxima compatibilidad con cualquier webcam
const BROADCAST_HD_VIDEO = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
}

// Perfil fluido 720p estándar (compatible con webcams integradas de laptop como EasyCamera)
const FLUID_720P_VIDEO = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
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
    // 1. Intento sin restricción de resolución (modo nativo del sensor de la webcam - máxima compatibilidad en Windows)
    videoAttempts.push({ deviceId: { exact: deviceId } })
    // 2. Intento 720p estándar (EasyCamera / laptops)
    videoAttempts.push({ deviceId: { exact: deviceId }, ...FLUID_720P_VIDEO })
    // 3. Intento HD 1080p
    videoAttempts.push({ deviceId: { exact: deviceId }, ...BROADCAST_HD_VIDEO })
    // 4. Intento con ID ideal (tolerante a cambios de puerto USB o identificador de sesión)
    videoAttempts.push({ deviceId: { ideal: deviceId } })
    videoAttempts.push({ deviceId: { ideal: deviceId }, ...FLUID_720P_VIDEO })
    videoAttempts.push({ deviceId })
  }

  // 5. Fallbacks genéricos si el deviceId no responde
  videoAttempts.push({ ...FLUID_720P_VIDEO })
  videoAttempts.push({ ...BROADCAST_HD_VIDEO })
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
      // Si Windows Media Foundation informa que el hardware está ocupado, esperar 400ms y reintentar
      if (e?.name === 'NotReadableError' || e?.name === 'AbortError' || e?.name === 'TrackStartError') {
        await waitMs(400)
        try {
          return await navigator.mediaDevices.getUserMedia({ video, audio: false })
        } catch {}
      }
    }
  }

  // Último intento de rescate: abrir cualquier cámara de video disponible en el sistema
  try {
    await waitMs(500)
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch {}

  throw lastError || new Error('No se pudo abrir la cámara')
}
