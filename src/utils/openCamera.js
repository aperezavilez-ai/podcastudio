// ✅ FIX CRÍTICO #6: Resolución uniforme 1920x1080 para todo el pipeline
const BROADCAST_HD_VIDEO = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 60, min: 30 }, // ✅ Mínimo 30fps, no 24fps
}

export function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Envoltorio seguro para getUserMedia con límite de tiempo estricto.
 * Evita que bloqueos de controladores (como Lenovo Chicony 04f2:b57e) dejen la UI en 'Conectando...' permanentemente.
 */
export function getUserMediaWithTimeout(constraints, timeoutMs = 8000) {
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
    { facingMode: { ideal: facingMode }, ...BROADCAST_HD_VIDEO },
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
        }, 6000)
      } catch {}
    }
  }

  let lastError = null
  for (const video of videoAttempts) {
    try {
      return await getUserMediaWithTimeout({ video, audio: false }, 6000)
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
    // 1. Intento con deviceId y perfil Broadcast HD 1080p a 60 FPS
    videoAttempts.push({ deviceId: { ideal: deviceId }, ...BROADCAST_HD_VIDEO })
    // 2. Intento con deviceId y perfil 720p a 60 FPS
    videoAttempts.push({ deviceId: { ideal: deviceId }, ...BROADCAST_HD_VIDEO })
    // 3. Intento con deviceId ideal sin restricciones de resolución
    videoAttempts.push({ deviceId: { ideal: deviceId } })
    // 4. Intento con deviceId directo
    videoAttempts.push({ deviceId })
    // 5. Intento con deviceId exacto
    videoAttempts.push({ deviceId: { exact: deviceId } })
  }

  // Fallbacks genéricos si el ID específico no responde
  videoAttempts.push({ ...BROADCAST_HD_VIDEO })
  videoAttempts.push({ ...BROADCAST_HD_VIDEO })
  videoAttempts.push(true)

  const prepareStream = (s) => {
    if (s) {
      try {
        s.getVideoTracks().forEach(t => {
          try { t.contentHint = 'motion' } catch {}
        })
      } catch {}
    }
    return s
  }

  // Intentar con audio si se solicitó explícitamente
  if (withAudio) {
    for (const video of videoAttempts) {
      try {
        const stream = await getUserMediaWithTimeout({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        }, 6000)
        return prepareStream(stream)
      } catch {}
    }
  }

  // Flujo principal de video (más confiable y sin colisión con micrófonos de Windows)
  let lastError = null
  for (const video of videoAttempts) {
    try {
      const stream = await getUserMediaWithTimeout({ video, audio: false }, 6000)
      return prepareStream(stream)
    } catch (e) {
      lastError = e
      console.warn('[openCamera] Intento falló, probando siguiente configuración:', e?.name || e?.message)
      // Si Windows informa que el hardware está ocupado, esperar 400ms y reintentar
      if (e?.name === 'NotReadableError' || e?.name === 'AbortError' || e?.name === 'TrackStartError') {
        await waitMs(400)
        try {
          const stream = await getUserMediaWithTimeout({ video, audio: false }, 5000)
          return prepareStream(stream)
        } catch {}
      }
    }
  }

  // Último intento de rescate: abrir cualquier cámara de video disponible en el sistema
  try {
    await waitMs(400)
    const stream = await getUserMediaWithTimeout({ video: true, audio: false }, 5000)
    return prepareStream(stream)
  } catch {}

  throw lastError || new Error('No se pudo abrir la cámara')
}
