const UHD_4K_VIDEO = {
  width: { min: 1280, ideal: 3840, max: 3840 },
  height: { min: 720, ideal: 2160, max: 2160 },
  frameRate: { ideal: 30, max: 60 },
  aspectRatio: { ideal: 16 / 9 },
}

const HD_VIDEO = {
  width: { min: 640, ideal: 1920, max: 3840 },
  height: { min: 480, ideal: 1080, max: 2160 },
  frameRate: { ideal: 30, max: 60 },
  aspectRatio: { ideal: 16 / 9 },
}

export async function openCameraStreamFacing(facingMode, withAudio = true) {
  const attempts = [
    { facingMode: { exact: facingMode }, ...UHD_4K_VIDEO },
    { facingMode: { ideal: facingMode }, width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } },
    { facingMode: { exact: facingMode }, ...HD_VIDEO },
    { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode },
  ]

  if (withAudio) {
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
      } catch {}
    }
  }

  let lastError = null
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false })
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('No se pudo abrir la cámara')
}

export async function openCameraStream(deviceId, withAudio = true) {
  const videoAttempts = deviceId
    ? [
        { deviceId: { exact: deviceId }, ...UHD_4K_VIDEO },
        { deviceId: { exact: deviceId }, width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } },
        { deviceId: { exact: deviceId }, ...HD_VIDEO },
        { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        { deviceId: { ideal: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { deviceId: { exact: deviceId } },
        { deviceId: { ideal: deviceId } },
      ]
    : [
        { ...UHD_4K_VIDEO },
        { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } },
        { ...HD_VIDEO },
        { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        { width: { ideal: 1280 }, height: { ideal: 720 } },
        true,
      ]

  if (withAudio) {
    for (const video of videoAttempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
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

  throw lastError || new Error('No se pudo abrir la cámara')
}

export function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms))
}
