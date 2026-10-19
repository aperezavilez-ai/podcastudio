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

/**
 * Envoltorio seguro para getUserMedia con límite de tiempo estricto.
 * Evita que bloqueos de controladores (como Lenovo Chicony 04f2:b57e) dejen la UI en 'Conectando...' permanentemente.
 */
export function getUserMediaWithTimeout(constraints, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('Timeout de hardware: la cámara no respondió a tiempo. Comprueba que no esté bloqueada físicamente.'))
      }
    }, timeoutMs)

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve(stream)
        } else {
          // Si respondió después del timeout, detener pistas para no dejar la cámara tomada
          try { stream.getTracks().forEach(t => t.stop()) } catch {}
        }
      })
      .catch((err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          reject(err)
        }
      })
  })
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
        return await getUserMediaWithTimeout({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        }, 4000)
      } catch {}
    }
  }

  let lastError = null
  for (const video of videoAttempts) {
    try {
      return await getUserMediaWithTimeout({ video, audio: false }, 3500)
    } catch (e) {
      lastError = e
    }
  }

  throw lastError || new Error('No se pudo abrir la cámara móvil')
}

/**
 * Abre el flujo de una cámara USB o integrada con múltiples niveles de fallback
 * y tolerancia a bloqueos temporales de Windows Media Foundation y DirectShow.
 */
export async function openCameraStream(deviceId, withAudio = false) {
  const videoAttempts = []

  if (deviceId) {
    // 1. Intento sin restricción de resolución (modo nativo del sensor - máxima compatibilidad en Windows DirectShow)
    videoAttempts.push({ deviceId: { exact: deviceId } })
    // 2. Intento con deviceId directo
    videoAttempts.push({ deviceId })
    // 3. Intento con ID ideal (tolerante a cambios de puerto USB o identificador de sesión)
    videoAttempts.push({ deviceId: { ideal: deviceId } })
    // 4. Intento 720p estándar (EasyCamera / laptops)
    videoAttempts.push({ deviceId: { exact: deviceId }, ...FLUID_720P_VIDEO })
    videoAttempts.push({ deviceId: { ideal: deviceId }, ...FLUID_720P_VIDEO })
  }

  // 5. Fallbacks genéricos si el deviceId no responde
  videoAttempts.push(true)
  videoAttempts.push({ ...FLUID_720P_VIDEO })
  videoAttempts.push({ ...BROADCAST_HD_VIDEO })

  // Intentar con audio si se solicitó explícitamente
  if (withAudio) {
    for (const video of videoAttempts) {
      try {
        return await getUserMediaWithTimeout({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        }, 3500)
      } catch {}
    }
  }

  // Flujo principal de video (más confiable y sin colisión con micrófonos de Windows)
  let lastError = null
  for (const video of videoAttempts) {
    try {
      return await getUserMediaWithTimeout({ video, audio: false }, 3500)
    } catch (e) {
      lastError = e
      // Si Windows informa que el hardware está ocupado, esperar 350ms y reintentar
      if (e?.name === 'NotReadableError' || e?.name === 'AbortError' || e?.name === 'TrackStartError') {
        await waitMs(350)
        try {
          return await getUserMediaWithTimeout({ video, audio: false }, 3000)
        } catch {}
      }
    }
  }

  // Último intento de rescate: abrir cualquier cámara de video disponible en el sistema
  try {
    await waitMs(300)
    return await getUserMediaWithTimeout({ video: true, audio: false }, 3000)
  } catch {}

  throw lastError || new Error('No se pudo abrir la cámara')
}
