// Perfil broadcast 1080p de latencia ultrabaja (estándar de televisión en vivo)
const BROADCAST_HD_VIDEO = {
  width: { ideal: 1920, max: 1920 },
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 30, max: 60 },
  aspectRatio: { ideal: 16 / 9 },
}

// Perfil fluido 720p de alta tasa de cuadros (60 fps sin retardo)
const FLUID_720P_VIDEO = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 30, max: 60 },
  aspectRatio: { ideal: 16 / 9 },
}

const UHD_4K_FALLBACK = {
  width: { ideal: 3840, max: 3840 },
  height: { ideal: 2160, max: 2160 },
  frameRate: { ideal: 30 },
  aspectRatio: { ideal: 16 / 9 },
}

export async function openCameraStreamFacing(facingMode, withAudio = true) {
  const attempts = [
    { facingMode: { exact: facingMode }, ...BROADCAST_HD_VIDEO },
    { facingMode: { ideal: facingMode }, ...BROADCAST_HD_VIDEO },
    { facingMode: { ideal: facingMode }, ...FLUID_720P_VIDEO },
    { facingMode: { exact: facingMode }, ...UHD_4K_FALLBACK },
    { facingMode: { ideal: facingMode } },
    { facingMode },
  ]

  if (withAudio) {
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video,
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // El DSP propio de useAudioMix hace el filtrado sin agregar 150ms de latencia de búfer
            autoGainControl: true,
            latency: { ideal: 0 },
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
        { deviceId: { exact: deviceId }, ...BROADCAST_HD_VIDEO },
        { deviceId: { ideal: deviceId }, ...BROADCAST_HD_VIDEO },
        { deviceId: { exact: deviceId }, ...FLUID_720P_VIDEO },
        { deviceId: { ideal: deviceId }, ...FLUID_720P_VIDEO },
        { deviceId: { exact: deviceId }, ...UHD_4K_FALLBACK },
        { deviceId: { exact: deviceId } },
        { deviceId: { ideal: deviceId } },
      ]
    : [
        { ...BROADCAST_HD_VIDEO },
        { ...FLUID_720P_VIDEO },
        { ...UHD_4K_FALLBACK },
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
            latency: { ideal: 0 },
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
