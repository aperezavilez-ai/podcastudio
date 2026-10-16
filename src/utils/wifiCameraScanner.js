import { supabase } from '../lib/supabase.js'

// Endpoints comunes de cámaras Wi-Fi y apps móviles en red local
export const COMMON_WIFI_TARGETS = [
  {
    name: 'DroidCam (Celular iPhone / Android)',
    type: 'phone_app',
    port: 4747,
    path: '/video',
    testPath: '/video',
  },
  {
    name: 'IP Webcam (Celular Android / SmartCam)',
    type: 'phone_app',
    port: 8080,
    path: '/video',
    testPath: '/shot.jpg',
  },
  {
    name: 'GoPro Hero WiFi (Red directa)',
    type: 'action_cam',
    ip: '10.5.5.9',
    port: 8080,
    path: '/live/amba.m3u8',
    testPath: '/live/amba.m3u8',
  },
  {
    name: 'Cámara Acción SJCam / Eken (Wi-Fi directo)',
    type: 'action_cam',
    ip: '192.168.1.254',
    port: 8192,
    path: '',
    testPath: '',
  },
  {
    name: 'Cámara Acción 4K (LiveDV / XDV IP)',
    type: 'action_cam',
    ip: '192.168.42.1',
    port: 8080,
    path: '',
    testPath: '',
  },
  {
    name: 'OBS / NDI HLS Stream Local',
    type: 'stream_server',
    ip: 'localhost',
    port: 8080,
    path: '/hls/stream.m3u8',
    testPath: '/hls/stream.m3u8',
  },
]

/**
 * Prueba rápidamente si una URL HTTP/MJPEG responde
 */
export async function probeHttpUrl(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(false)
      }
    }, timeoutMs)

    // Intento 1: Image element (ideal para MJPEG / shot.jpg sin bloqueo CORS)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        img.src = ''
        resolve(true)
      }
    }
    img.onerror = () => {
      // Si falla como imagen, probar con fetch no-cors
      if (!resolved) {
        try {
          fetch(url, { method: 'GET', mode: 'no-cors' })
            .then(() => {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                resolve(true)
              }
            })
            .catch(() => {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                resolve(false)
              }
            })
        } catch {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve(false)
          }
        }
      }
    }
    img.src = url
  })
}

/**
 * Descubre celulares con la página de cámara remota abierta en la misma sesión/red
 */
export async function discoverCellphones(timeoutMs = 2500) {
  if (!supabase) return []

  return new Promise((resolve) => {
    const found = new Map()
    const channel = supabase.channel('remotecam_presence', {
      config: { broadcast: { self: false } },
    })

    const timer = setTimeout(() => {
      channel.unsubscribe().catch(() => {})
      resolve(Array.from(found.values()))
    }, timeoutMs)

    channel.on('broadcast', { event: 'pong-presence' }, (event) => {
      const payload = event?.payload
      if (payload && payload.id && !found.has(payload.id)) {
        found.set(payload.id, {
          id: payload.id,
          name: payload.deviceName || 'Celular (iPhone / Android)',
          type: 'remote_phone',
          facing: payload.facing || 'environment',
          roomCode: payload.roomCode,
          slot: payload.slot,
          available: payload.available ?? true,
        })
      }
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'ping-presence',
          payload: { timestamp: Date.now() },
        }).catch(() => {})
      }
    })
  })
}

/**
 * Escáner combinado de cámaras Wi-Fi y celulares en la red
 */
export async function scanWifiCameras({ onProgress } = {}) {
  const discovered = []

  // 1. Descubrir celulares vía señalización en tiempo real
  if (onProgress) onProgress('Buscando celulares iPhone y Android en la red...')
  try {
    const phones = await discoverCellphones(2000)
    for (const p of phones) {
      discovered.push(p)
    }
  } catch (err) {
    console.warn('Error descubriendo celulares:', err)
  }

  // 2. Probar presets conocidos de red local fija (GoPro, Action Cam directas, etc.)
  if (onProgress) onProgress('Sondeando cámaras de acción y streams locales...')
  const fixedTargets = COMMON_WIFI_TARGETS.filter(t => t.ip)

  await Promise.allSettled(
    fixedTargets.map(async (target) => {
      const url = `http://${target.ip}:${target.port}${target.path}`
      const testUrl = `http://${target.ip}:${target.port}${target.testPath || target.path}`
      const isReachable = await probeHttpUrl(testUrl, 1000)
      if (isReachable) {
        discovered.push({
          id: `fixed_${target.ip}_${target.port}`,
          name: target.name,
          url,
          type: target.type,
        })
      }
    }),
  )

  return discovered
}
