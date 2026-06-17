import { useState, useEffect, useRef, useCallback } from 'react'

const WIFI_PRESETS = [
  { label: 'IP Webcam (Android)', url: 'http://192.168.1.100:8080/video' },
  { label: 'GoPro (WiFi)', url: 'http://10.5.5.9:8080/live/amba.m3u8' },
  { label: 'Cámara MJPEG genérica', url: 'http://192.168.1.100:8080/video' },
  { label: 'DroidCam', url: 'http://192.168.1.100:4747/video' },
]

const BT_CAMERA_PREFIXES = ['GoPro', 'Insta360', 'DJI', 'Osmo', 'Canon', 'Sony', 'Ricoh', 'Theta', 'AKASO', 'Campark']

function uniqueCameras(cameras) {
  const seen = new Set()
  return cameras.filter(cam => {
    const key = cam.groupId || cam.deviceId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function isMjpegUrl(url) {
  const u = url.toLowerCase()
  return u.includes('/video') || u.includes('mjpeg') || u.includes('/cam') || u.endsWith('.mjpg')
}

function isHlsUrl(url) {
  return url.toLowerCase().includes('.m3u8')
}

async function createWifiStream(url) {
  if (isHlsUrl(url)) {
    throw new Error('Streams HLS (.m3u8) requieren un proxy o convertidor. Usa MJPEG o una URL de video directa.')
  }

  if (isMjpegUrl(url) || url.match(/:\d+\/(video|shot|stream)/i)) {
    return createMjpegStream(url)
  }

  return createVideoElementStream(url)
}

function createMjpegStream(url) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'

    let stream = null
    let rafId = null
    let failed = false

    const draw = () => {
      if (img.naturalWidth > 0) {
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
        }
        ctx.drawImage(img, 0, 0)
      }
      rafId = requestAnimationFrame(draw)
    }

    img.onload = () => {
      if (!stream) {
        stream = canvas.captureStream(24)
        draw()
        resolve({
          stream,
          cleanup: () => {
            if (rafId) cancelAnimationFrame(rafId)
            img.src = ''
          },
        })
      }
    }

    img.onerror = () => {
      if (!stream && !failed) {
        failed = true
        reject(new Error('No se pudo conectar al stream WiFi. Verifica la IP y que la cámara esté en la misma red.'))
      }
    }

    img.src = url
  })
}

async function createVideoElementStream(url) {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.src = url

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
    video.onerror = () => reject(new Error('URL de video no válida o inaccesible'))
    video.play().catch(reject)
  })

  const stream = video.captureStream()
  return {
    stream,
    cleanup: () => {
      video.pause()
      video.src = ''
      video.remove()
    },
  }
}

export function useWebcam() {
  const [devices, setDevices] = useState({ cameras: [], microphones: [] })
  const [streams, setStreams] = useState({})
  const [cameraMeta, setCameraMeta] = useState({})
  const [activeCamera, setActiveCamera] = useState(null)
  const [error, setError] = useState(null)
  const [micLevel, setMicLevel] = useState(0)
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const [btScanning, setBtScanning] = useState(false)
  const [autoConnecting, setAutoConnecting] = useState(false)
  const [connectedCount, setConnectedCount] = useState(0)

  const micRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const cleanupRef = useRef({})
  const streamsRef = useRef({})
  const cameraMetaRef = useRef({})

  useEffect(() => { streamsRef.current = streams }, [streams])
  useEffect(() => { cameraMetaRef.current = cameraMeta }, [cameraMeta])

  useEffect(() => {
    setBluetoothSupported(typeof navigator !== 'undefined' && !!navigator.bluetooth)
  }, [])

  const setSlotCleanup = useCallback((slotIndex, fn) => {
    cleanupRef.current[slotIndex]?.()
    cleanupRef.current[slotIndex] = fn
  }, [])

  const enumerateDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const all = await navigator.mediaDevices.enumerateDevices()
      const cams = uniqueCameras(all.filter(d => d.kind === 'videoinput'))
      const mics = all.filter(d => d.kind === 'audioinput')
      setDevices({ cameras: cams, microphones: mics })
      return { cameras: cams, microphones: mics }
    } catch {
      setError('No se pudo acceder a las cámaras. Verifica los permisos del navegador.')
      return { cameras: [], microphones: [] }
    }
  }, [])

  const attachStream = useCallback((slotIndex, stream, meta) => {
    setStreams(prev => ({ ...prev, [slotIndex]: stream }))
    setCameraMeta(prev => ({ ...prev, [slotIndex]: meta }))
    setActiveCamera(prev => (prev === null ? slotIndex : prev))
    setError(null)
  }, [])

  const stopCamera = useCallback((slotIndex) => {
    setSlotCleanup(slotIndex, null)
    delete cleanupRef.current[slotIndex]

    setStreams(prev => {
      const s = prev[slotIndex]
      if (s) s.getTracks().forEach(t => t.stop())
      const next = { ...prev }
      delete next[slotIndex]
      return next
    })

    setCameraMeta(prev => {
      const next = { ...prev }
      delete next[slotIndex]
      return next
    })
  }, [setSlotCleanup])

  const startCamera = useCallback(async (deviceId, slotIndex, labelOverride) => {
    try {
      stopCamera(slotIndex)
      const constraints = {
        video: deviceId
          ? { deviceId: { ideal: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      }
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        if (!deviceId) throw new Error('no device')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      }
      const label = labelOverride
        || devices.cameras.find(c => c.deviceId === deviceId)?.label
        || `USB Cam ${slotIndex + 1}`
      attachStream(slotIndex, stream, { type: 'usb', label, deviceId })
      return stream
    } catch {
      setError(`No se pudo iniciar la cámara USB ${slotIndex + 1}`)
      return null
    }
  }, [attachStream, devices.cameras, stopCamera])

  const autoConnectAll = useCallback(async (cameraList) => {
    const list = uniqueCameras(cameraList || devices.cameras)
    if (!list.length) {
      setConnectedCount(0)
      return 0
    }

    setAutoConnecting(true)
    setError(null)
    let connected = 0

    for (let i = 0; i < Math.min(3, list.length); i++) {
      const cam = list[i]
      const stream = await startCamera(cam.deviceId, i, cam.label || `USB Cam ${i + 1}`)
      if (stream) {
        connected++
        await delay(300)
      }
    }

    if (connected > 0) setActiveCamera(prev => (prev === null ? 0 : prev))
    setConnectedCount(connected)
    setAutoConnecting(false)
    return connected
  }, [devices.cameras, startCamera])

  const connectWifiCamera = useCallback(async (url, slotIndex, label) => {
    const trimmed = url?.trim()
    if (!trimmed) {
      setError('Ingresa la URL del stream WiFi de la cámara.')
      return null
    }

    setWifiConnecting(true)
    setError(null)

    try {
      stopCamera(slotIndex)
      const { stream, cleanup } = await createWifiStream(trimmed)
      setSlotCleanup(slotIndex, cleanup)
      attachStream(slotIndex, stream, {
        type: 'wifi',
        label: label || 'Cámara WiFi',
        url: trimmed,
      })
      return stream
    } catch (e) {
      setError(e.message || 'Error al conectar cámara WiFi')
      return null
    } finally {
      setWifiConnecting(false)
    }
  }, [attachStream, setSlotCleanup, stopCamera])

  const scanBluetoothCamera = useCallback(async (slotIndex) => {
    if (!navigator.bluetooth) {
      setError('Bluetooth no disponible. Usa Chrome/Edge en HTTPS o localhost.')
      return null
    }

    setBtScanning(true)
    setError(null)

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'battery_service',
          'device_information',
          '0000180a-0000-1000-8000-00805f9b34fb',
        ],
      })

      await device.gatt?.connect()
      const name = device.name || 'Dispositivo Bluetooth'

      const isLikelyCamera = BT_CAMERA_PREFIXES.some(p => name.toLowerCase().includes(p.toLowerCase()))
      const suggestedUrl = name.toLowerCase().includes('gopro')
        ? 'http://10.5.5.9:8080/live/amba.m3u8'
        : 'http://192.168.1.100:8080/video'

      setCameraMeta(prev => ({
        ...prev,
        [slotIndex]: {
          type: 'bluetooth',
          label: name,
          deviceId: device.id,
          paired: true,
          suggestedUrl,
          isLikelyCamera,
          awaitingWifi: true,
        },
      }))

      device.addEventListener('gattserverdisconnected', () => {
        setCameraMeta(prev => {
          const meta = prev[slotIndex]
          if (meta?.type === 'bluetooth' && meta.deviceId === device.id) {
            return { ...prev, [slotIndex]: { ...meta, paired: false } }
          }
          return prev
        })
      })

      return { device, name, suggestedUrl, isLikelyCamera }
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        setError(e.message || 'No se pudo emparejar el dispositivo Bluetooth')
      }
      return null
    } finally {
      setBtScanning(false)
    }
  }, [])

  const connectBluetoothWifiStream = useCallback(async (slotIndex, url) => {
    const meta = cameraMeta[slotIndex]
    const streamUrl = url || meta?.suggestedUrl
    if (!streamUrl) {
      setError('Empareja primero un dispositivo Bluetooth o ingresa la URL WiFi.')
      return null
    }

    const result = await connectWifiCamera(streamUrl, slotIndex, meta?.label || 'BT + WiFi')
    if (result) {
      setCameraMeta(prev => ({
        ...prev,
        [slotIndex]: {
          ...prev[slotIndex],
          type: 'bluetooth',
          awaitingWifi: false,
          url: streamUrl,
          paired: true,
        },
      }))
    }
    return result
  }, [cameraMeta, connectWifiCamera])

  const startMic = useCallback(async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      micRef.current = stream
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setMicLevel(Math.round((avg / 255) * 100))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      setError('No se pudo acceder al micrófono.')
    }
  }, [])

  const stopMic = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (micRef.current) micRef.current.getTracks().forEach(t => t.stop())
  }, [])

  useEffect(() => () => {
    Object.values(cleanupRef.current).forEach(fn => fn?.())
    Object.values(streams).forEach(s => s?.getTracks().forEach(t => t.stop()))
    stopMic()
  }, [])

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return

    const onDeviceChange = async () => {
      const { cameras } = await enumerateDevices()
      const unique = uniqueCameras(cameras)
      let connected = 0

      for (let i = 0; i < Math.min(3, unique.length); i++) {
        const cam = unique[i]
        const meta = cameraMetaRef.current[i]
        const hasStream = !!streamsRef.current[i]

        if (!hasStream || (meta?.type === 'usb' && meta.deviceId !== cam.deviceId)) {
          const stream = await startCamera(cam.deviceId, i, cam.label || `USB Cam ${i + 1}`)
          if (stream) connected++
        } else if (hasStream) {
          connected++
        }
      }

      setConnectedCount(connected)
    }

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
  }, [enumerateDevices, startCamera])

  return {
    devices,
    streams,
    cameraMeta,
    activeCamera,
    setActiveCamera,
    error,
    setError,
    micLevel,
    bluetoothSupported,
    wifiConnecting,
    btScanning,
    autoConnecting,
    connectedCount,
    wifiPresets: WIFI_PRESETS,
    enumerateDevices,
    startCamera,
    autoConnectAll,
    stopCamera,
    connectWifiCamera,
    scanBluetoothCamera,
    connectBluetoothWifiStream,
    startMic,
    stopMic,
  }
}
