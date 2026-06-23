import { useState, useEffect, useRef, useCallback } from 'react'
import { pickPreferredMicrophone, isBuiltInMicrophone } from '../utils/micDevices.js'
import { openCameraStream, openCameraStreamFacing, waitMs } from '../utils/openCamera.js'
import { applyStreamQualityHints } from '../utils/videoStream.js'
import { isTouchDevice } from '../lib/device.js'
import { PRIMARY_CAMERA_SLOT, pickPrimaryActiveSlot } from '../config/cameraSlots.js'

const WIFI_PRESETS = [
  { label: 'IP Webcam (Android)', url: 'http://192.168.1.100:8080/video' },
  { label: 'GoPro (WiFi)', url: 'http://10.5.5.9:8080/live/amba.m3u8' },
  { label: 'Cámara MJPEG genérica', url: 'http://192.168.1.100:8080/video' },
  { label: 'DroidCam', url: 'http://192.168.1.100:4747/video' },
]

const BT_CAMERA_PREFIXES = ['GoPro', 'Insta360', 'DJI', 'Osmo', 'Canon', 'Sony', 'Ricoh', 'Theta', 'AKASO', 'Campark']

const FAKE_DEVICE_IDS = new Set(['default', 'communications'])

function uniqueCameras(cameras) {
  const byDeviceId = new Map()

  for (const cam of cameras) {
    if (!cam.deviceId || FAKE_DEVICE_IDS.has(cam.deviceId)) continue
    if (!byDeviceId.has(cam.deviceId)) byDeviceId.set(cam.deviceId, cam)
  }

  if (byDeviceId.size > 0) return Array.from(byDeviceId.values())

  const seen = new Set()
  return cameras.filter(cam => {
    const key = cam.groupId || cam.deviceId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getAssignedDeviceIds(metaMap, streamMap) {
  return new Set(
    Object.entries(metaMap)
      .filter(([slot, meta]) => streamMap[slot] && meta?.type === 'usb' && meta.deviceId)
      .map(([, meta]) => meta.deviceId),
  )
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
  const [selectedMicId, setSelectedMicId] = useState(null)
  const [micLabel, setMicLabel] = useState('')
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const [btScanning, setBtScanning] = useState(false)
  const [autoConnecting, setAutoConnecting] = useState(false)
  const [connectedCount, setConnectedCount] = useState(0)
  const [mobilePrimaryFacing, setMobilePrimaryFacing] = useState('environment')

  const micRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const selectedMicIdRef = useRef(null)
  const autoConnectLockRef = useRef(false)
  const connectedCountRef = useRef(0)
  const deviceChangeTimerRef = useRef(null)
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

  useEffect(() => { selectedMicIdRef.current = selectedMicId }, [selectedMicId])

  const enumerateDevices = useCallback(async (requestPermission = true) => {
    try {
      if (requestPermission) {
        let stream
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        }
        stream?.getTracks().forEach(t => t.stop())
        await waitMs(250)

        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          audioStream.getTracks().forEach(t => t.stop())
        } catch { /* mic permission optional */ }
      }
      const all = await navigator.mediaDevices.enumerateDevices()
      const cams = uniqueCameras(all.filter(d => d.kind === 'videoinput'))
      const mics = all.filter(d => d.kind === 'audioinput' && !FAKE_DEVICE_IDS.has(d.deviceId))
      setDevices({ cameras: cams, microphones: mics })
      return { cameras: cams, microphones: mics }
    } catch {
      setError('No se pudo acceder a las cámaras. Verifica los permisos del navegador.')
      return { cameras: [], microphones: [] }
    }
  }, [])

  const attachStream = useCallback((slotIndex, stream, meta) => {
    setStreams(prev => {
      const next = { ...prev, [slotIndex]: stream }
      streamsRef.current = next
      return next
    })
    setCameraMeta(prev => {
      const next = { ...prev, [slotIndex]: meta }
      cameraMetaRef.current = next
      return next
    })
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
      streamsRef.current = next
      return next
    })

    setCameraMeta(prev => {
      const next = { ...prev }
      delete next[slotIndex]
      cameraMetaRef.current = next
      return next
    })
  }, [setSlotCleanup])

  const startCamera = useCallback(async (deviceId, slotIndex, labelOverride) => {
    try {
      stopCamera(slotIndex)
      const stream = await openCameraStream(deviceId)
      applyStreamQualityHints(stream)
      const track = stream.getVideoTracks()[0]
      const activeId = track?.getSettings?.().deviceId || deviceId
      const label = labelOverride
        || devices.cameras.find(c => c.deviceId === activeId || c.deviceId === deviceId)?.label
        || track?.label
        || `USB Cam ${slotIndex + 1}`
      attachStream(slotIndex, stream, { type: 'usb', label, deviceId: activeId || deviceId })
      setActiveCamera((prev) => {
        if (prev !== null && streamsRef.current[prev]) return prev
        return slotIndex
      })
      return stream
    } catch (e) {
      console.error('startCamera:', e)
      setError(`No se pudo iniciar la cámara ${slotIndex + 1}. Cierra otras apps que usen la cámara e intenta de nuevo.`)
      return null
    }
  }, [attachStream, devices.cameras, stopCamera])

  const initMobileCameras = useCallback(async () => {
    if (autoConnectLockRef.current) return connectedCountRef.current

    autoConnectLockRef.current = true
    setAutoConnecting(true)
    setError(null)

    try {
      for (let slot = 0; slot < 3; slot++) stopCamera(slot)

      let facing = 'environment'
      let stream = null

      try {
        stream = await openCameraStreamFacing('environment')
      } catch {
        facing = 'user'
        stream = await openCameraStreamFacing('user')
      }

      applyStreamQualityHints(stream)
      const label = facing === 'user' ? 'Cámara frontal' : 'Cámara trasera'
      attachStream(PRIMARY_CAMERA_SLOT, stream, { type: 'usb', label, facing })
      setMobilePrimaryFacing(facing)
      setActiveCamera(PRIMARY_CAMERA_SLOT)
      setConnectedCount(1)
      connectedCountRef.current = 1
      return 1
    } catch (e) {
      console.error('initMobileCameras:', e)
      setError('No se pudo iniciar la cámara. Autoriza el acceso e intenta de nuevo.')
      setConnectedCount(0)
      connectedCountRef.current = 0
      return 0
    } finally {
      autoConnectLockRef.current = false
      setAutoConnecting(false)
    }
  }, [attachStream, stopCamera])

  const switchMobilePrimaryFacing = useCallback(async () => {
    const next = mobilePrimaryFacing === 'environment' ? 'user' : 'environment'
    setAutoConnecting(true)
    setError(null)

    try {
      stopCamera(PRIMARY_CAMERA_SLOT)
      const stream = await openCameraStreamFacing(next)
      applyStreamQualityHints(stream)
      const label = next === 'user' ? 'Cámara frontal' : 'Cámara trasera'
      attachStream(PRIMARY_CAMERA_SLOT, stream, { type: 'usb', label, facing: next })
      setMobilePrimaryFacing(next)
      setActiveCamera(PRIMARY_CAMERA_SLOT)
    } catch (e) {
      console.error('switchMobilePrimaryFacing:', e)
      setError('No se pudo cambiar de cámara. Cierra otras apps que usen la cámara.')
    } finally {
      setAutoConnecting(false)
    }
  }, [attachStream, mobilePrimaryFacing, stopCamera])

  const autoConnectAll = useCallback(async (cameraList, maxCameras = 3) => {
    if (autoConnectLockRef.current) return connectedCountRef.current
    if (isTouchDevice()) return initMobileCameras()

    const list = uniqueCameras(cameraList || devices.cameras)
    if (!list.length) {
      setConnectedCount(0)
      connectedCountRef.current = 0
      return 0
    }

    autoConnectLockRef.current = true
    setAutoConnecting(true)
    setError(null)
    let connected = 0

    try {
      const usedDeviceIds = getAssignedDeviceIds(cameraMetaRef.current, streamsRef.current)

      if (list.length === 1) {
        if (!streamsRef.current[PRIMARY_CAMERA_SLOT]) {
          const cam = list[0]
          const stream = await startCamera(cam.deviceId, PRIMARY_CAMERA_SLOT, cam.label || 'CAM 2 · Centro')
          if (stream) connected = 1
        } else {
          connected = 1
        }
      } else {
        let camIdx = 0
        for (let slot = 0; slot < 3 && connected < maxCameras; slot++) {
          if (streamsRef.current[slot]) {
            connected++
            continue
          }

          while (camIdx < list.length && usedDeviceIds.has(list[camIdx].deviceId)) camIdx++
          if (camIdx >= list.length) break

          const cam = list[camIdx++]
          usedDeviceIds.add(cam.deviceId)
          const stream = await startCamera(cam.deviceId, slot, cam.label || `USB Cam ${slot + 1}`)
          if (stream) {
            connected++
            await delay(300)
          }
        }
      }

      setActiveCamera(pickPrimaryActiveSlot(streamsRef.current))
      setConnectedCount(connected)
      connectedCountRef.current = connected
      return connected
    } finally {
      autoConnectLockRef.current = false
      setAutoConnecting(false)
    }
  }, [devices.cameras, initMobileCameras, startCamera])

  const connectNextCameraToSlot = useCallback(async (slotIndex) => {
    const { cameras } = await enumerateDevices(false)
    const list = uniqueCameras(cameras)
    const usedDeviceIds = getAssignedDeviceIds(cameraMetaRef.current, streamsRef.current)
    const next = list.find(cam => !usedDeviceIds.has(cam.deviceId))
    if (!next) {
      setError('No hay más cámaras USB disponibles para este slot.')
      return null
    }
    return startCamera(next.deviceId, slotIndex, next.label || `USB Cam ${slotIndex + 1}`)
  }, [enumerateDevices, startCamera])

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

  const stopMic = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (micRef.current) micRef.current.getTracks().forEach(t => t.stop())
    micRef.current = null
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close().catch(() => {})
    }
    audioCtxRef.current = null
    analyserRef.current = null
    setMicLevel(0)
  }, [])

  const startMic = useCallback(async (deviceId) => {
    stopMic()
    try {
      const constraints = {
        audio: deviceId
          ? {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
          : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        video: false,
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        if (!deviceId) throw new Error('no mic')
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { ideal: deviceId } },
          video: false,
        })
      }

      const track = stream.getAudioTracks()[0]
      const activeId = track?.getSettings?.().deviceId || deviceId
      const label = track?.label || devices.microphones.find(m => m.deviceId === activeId)?.label || ''

      micRef.current = stream
      setSelectedMicId(activeId)
      setMicLabel(label)
      selectedMicIdRef.current = activeId
      if (activeId) localStorage.setItem('podcastudio_mic_id', activeId)

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
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
      setError(null)
      return stream
    } catch {
      setError('No se pudo acceder al micrófono seleccionado.')
      return null
    }
  }, [devices.microphones, stopMic])

  const switchMic = useCallback(async (deviceId) => {
    if (!deviceId) return null
    return startMic(deviceId)
  }, [startMic])

  const startPreferredMic = useCallback(async (microphoneList) => {
    const mics = microphoneList || devices.microphones
    if (!mics.length) return null

    const savedId = localStorage.getItem('podcastudio_mic_id')
    const saved = savedId && mics.find(m => m.deviceId === savedId)
    const preferred = pickPreferredMicrophone(mics)
    const savedIsExternal = saved && !isBuiltInMicrophone(saved.label)
    const deviceId = savedIsExternal ? saved.deviceId : preferred?.deviceId

    return startMic(deviceId)
  }, [devices.microphones, startMic])

  const getMicStream = useCallback(() => micRef.current, [])

  useEffect(() => () => {
    Object.values(cleanupRef.current).forEach(fn => fn?.())
    Object.values(streams).forEach(s => s?.getTracks().forEach(t => t.stop()))
    stopMic()
  }, [])

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return

    const onDeviceChange = () => {
      clearTimeout(deviceChangeTimerRef.current)
      deviceChangeTimerRef.current = setTimeout(async () => {
        const { cameras, microphones } = await enumerateDevices(false)
        const connected = Object.values(streamsRef.current).filter(Boolean).length
        if (isTouchDevice()) {
          if (connected === 0) await initMobileCameras()
        } else if (cameras.length > connected) {
          await autoConnectAll(cameras)
        }

        if (microphones.length === 0) return

        const preferred = pickPreferredMicrophone(microphones)
        const currentId = selectedMicIdRef.current
        const currentMic = microphones.find(m => m.deviceId === currentId)
        const currentIsBuiltin = !currentId || isBuiltInMicrophone(currentMic?.label)
        const preferredIsExternal = preferred && !isBuiltInMicrophone(preferred.label)

        if (preferredIsExternal && (currentIsBuiltin || preferred.deviceId !== currentId)) {
          await startMic(preferred.deviceId)
        } else if (!currentId && preferred) {
          await startMic(preferred.deviceId)
        }
      }, 600)
    }

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
  }, [enumerateDevices, autoConnectAll, initMobileCameras, startMic])

  return {
    devices,
    streams,
    cameraMeta,
    activeCamera,
    setActiveCamera,
    error,
    setError,
    micLevel,
    selectedMicId,
    micLabel,
    bluetoothSupported,
    wifiConnecting,
    btScanning,
    autoConnecting,
    connectedCount,
    mobilePrimaryFacing,
    wifiPresets: WIFI_PRESETS,
    enumerateDevices,
    startCamera,
    initMobileCameras,
    switchMobilePrimaryFacing,
    autoConnectAll,
    connectNextCameraToSlot,
    stopCamera,
    connectWifiCamera,
    scanBluetoothCamera,
    connectBluetoothWifiStream,
    startMic,
    startPreferredMic,
    switchMic,
    stopMic,
    getMicStream,
  }
}
