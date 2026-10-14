import { useEffect, useRef, useState, useCallback } from 'react'
import { PRIMARY_CAMERA_SLOT } from '../config/cameraSlots.js'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

const SIDE_SLOTS = [0, 2]
const WIDE_HOLD_MS = 4_000
const FACE_ZOOM_SEC = 10
const DEFAULT_CROP = { focusX: 0.5, focusY: 0.42, zoom: 1 }

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/** Encuadre instantáneo: rostro, cabeza o hombros según tamaño detectado. */
function cropFromFace(bb, vw, vh) {
  const faceWRatio = bb.width / vw
  const fx = clamp((bb.originX + bb.width / 2) / vw, 0.12, 0.88)
  const fy = clamp((bb.originY + bb.height * 0.46) / vh, 0.18, 0.62)

  let zoom
  if (faceWRatio < 0.09) {
    zoom = clamp(0.28 / faceWRatio, 1.22, 1.42)
  } else if (faceWRatio < 0.18) {
    zoom = clamp(0.34 / faceWRatio, 1.42, 1.68)
  } else {
    zoom = clamp(0.52 / faceWRatio, 1.65, 2.05)
  }

  return { focusX: fx, focusY: fy, zoom }
}

function emptyCrops() {
  return {
    0: { ...DEFAULT_CROP },
    1: { ...DEFAULT_CROP },
    2: { ...DEFAULT_CROP },
  }
}

function slotLabel(slot) {
  if (slot === 0) return 'CAM 1 · Izquierda'
  if (slot === 2) return 'CAM 3 · Derecha'
  return 'CAM 2 · MASTER'
}

export function useAIDirector({
  enabled,
  streams,
  micLevel,
  activeCamera,
  setActiveCamera,
  minCutSec = 4,
  micThreshold = 12,
  faceZoomSec = FACE_ZOOM_SEC,
}) {
  const zoomHoldMs = faceZoomSec * 1000
  const [directorCrops, setDirectorCrops] = useState(emptyCrops)
  const [directorStatus, setDirectorStatus] = useState('')
  const detectorRef = useRef(null)
  const videosRef = useRef({})
  const lastSwitchRef = useRef(0)
  const cycleRef = useRef({ 0: null, 2: null })
  const appliedCropRef = useRef(emptyCrops())
  const isAnalyzingRef = useRef(false)
  const statusRef = useRef('')

  const micLevelRef = useRef(micLevel)
  const streamsRef = useRef(streams)
  const activeCameraRef = useRef(activeCamera)
  const setActiveCameraRef = useRef(setActiveCamera)

  micLevelRef.current = micLevel
  streamsRef.current = streams
  activeCameraRef.current = activeCamera
  setActiveCameraRef.current = setActiveCamera

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function init() {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM)
        if (cancelled) return
        let detector
        try {
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
          })
        } catch {
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
            runningMode: 'VIDEO',
          })
        }
        if (!cancelled) detectorRef.current = detector
      } catch (e) {
        console.warn('Director IA FaceDetector init omitido (modo audio activo):', e.message)
      }
    }

    init()
    return () => {
      cancelled = true
      try { detectorRef.current?.close?.() } catch {}
      detectorRef.current = null
    }
  }, [enabled])

  // Vinculación directa y limpia de streams de video (sin clonar tracks)
  useEffect(() => {
    if (!enabled) {
      Object.values(videosRef.current).forEach(v => {
        try { v.srcObject = null } catch {}
      })
      videosRef.current = {}
      return
    }

    Object.entries(streams).forEach(([slot, stream]) => {
      const i = Number(slot)
      if (!stream) return
      if (!videosRef.current[i]) {
        const v = document.createElement('video')
        v.muted = true
        v.playsInline = true
        v.autoplay = true
        v.setAttribute('playsinline', '')
        v.setAttribute('webkit-playsinline', '')
        videosRef.current[i] = v
      }
      if (videosRef.current[i].srcObject !== stream) {
        videosRef.current[i].srcObject = stream
      }
      videosRef.current[i].play().catch(() => {})
    })

    Object.keys(videosRef.current).forEach((key) => {
      if (!streams[key]) {
        try { videosRef.current[key].srcObject = null } catch {}
        delete videosRef.current[key]
      }
    })
  }, [enabled, streams])

  const resolveSideTarget = useCallback((slot, face, now) => {
    const hasFace = (face?.faceScore ?? 0) > 0.06
    if (!cycleRef.current[slot]) {
      cycleRef.current[slot] = {
        phase: 'wide',
        phaseStart: now,
        lockedCrop: null,
      }
    }

    const cycle = cycleRef.current[slot]
    const elapsed = now - cycle.phaseStart

    if (cycle.phase === 'zoom') {
      if (elapsed >= zoomHoldMs) {
        cycle.phase = 'wide'
        cycle.phaseStart = now
        cycle.lockedCrop = null
        return { crop: { ...DEFAULT_CROP }, status: 'Plano general' }
      }
      const remaining = Math.ceil((zoomHoldMs - elapsed) / 1000)
      const crop = cycle.lockedCrop || { ...DEFAULT_CROP }
      return { crop, status: `Plano cerrado · ${remaining}s` }
    }

    // Plano general — sin zoom
    if (elapsed >= WIDE_HOLD_MS && hasFace && face.boundingBox) {
      cycle.phase = 'zoom'
      cycle.phaseStart = now
      cycle.lockedCrop = cropFromFace(
        face.boundingBox,
        face.videoWidth,
        face.videoHeight,
      )
      return {
        crop: cycle.lockedCrop,
        status: `Plano cerrado · ${faceZoomSec}s`,
      }
    }

    return { crop: { ...DEFAULT_CROP }, status: 'Plano general' }
  }, [zoomHoldMs, faceZoomSec])

  // Análisis liviano, sin bloqueos de GPU y sin re-ejecución descontrolada
  const analyze = useCallback(() => {
    if (isAnalyzingRef.current) return
    isAnalyzingRef.current = true

    try {
      const activeStreams = streamsRef.current
      const curMic = micLevelRef.current
      const currentActive = activeCameraRef.current ?? PRIMARY_CAMERA_SLOT
      const detector = detectorRef.current

      const slots = [0, 1, 2].filter((i) => activeStreams[i] && videosRef.current[i]?.videoWidth)
      if (slots.length === 0) return

      const speaking = curMic >= micThreshold
      const scores = {}
      const faces = {}
      const now = Date.now()

      for (const slot of slots) {
        const video = videosRef.current[slot]
        let faceScore = 0
        let fx = 0.5
        let fy = 0.42
        let boundingBox = null
        const vw = video.videoWidth || 640
        const vh = video.videoHeight || 480

        if (detector && video.readyState >= 2) {
          try {
            const result = detector.detectForVideo(video, performance.now())
            const det = result.detections?.[0]
            if (det?.boundingBox) {
              boundingBox = det.boundingBox
              fx = (boundingBox.originX + boundingBox.width / 2) / vw
              fy = (boundingBox.originY + boundingBox.height * 0.55) / vh
              faceScore = (boundingBox.width * boundingBox.height) / (vw * vh) * 8
            }
          } catch { /* skip frame */ }
        }

        scores[slot] = faceScore + (slot === currentActive ? 0.2 : 0)
        faces[slot] = { fx, fy, faceScore, boundingBox, videoWidth: vw, videoHeight: vh }
      }

      // Switcheo por actividad vocal y presencia de rostro
      if (speaking && slots.length > 1) {
        const sideActive = SIDE_SLOTS.filter((s) => activeStreams[s])
        const pool = sideActive.length > 0 ? sideActive : slots.filter((s) => s !== PRIMARY_CAMERA_SLOT)
        const best = pool.reduce((a, b) => (scores[a] >= scores[b] ? a : b))

        if (
          best !== currentActive &&
          scores[best] > (scores[currentActive] ?? 0) * 1.15 &&
          now - lastSwitchRef.current > minCutSec * 1000
        ) {
          setActiveCameraRef.current?.(best)
          lastSwitchRef.current = now
        }
      }

      const nextCrops = emptyCrops()
      let statusDetail = ''

      for (const slot of [0, 1, 2]) {
        if (slot === PRIMARY_CAMERA_SLOT || !activeStreams[slot]) {
          nextCrops[slot] = { ...DEFAULT_CROP }
          appliedCropRef.current[slot] = { ...DEFAULT_CROP }
          continue
        }

        const { crop, status } = resolveSideTarget(slot, faces[slot], now)
        if (slot === currentActive) statusDetail = status
        nextCrops[slot] = { ...crop }
        appliedCropRef.current[slot] = { ...crop }
      }

      setDirectorCrops(nextCrops)

      const cam = activeCameraRef.current ?? PRIMARY_CAMERA_SLOT
      const camLabel = slotLabel(cam)
      const nextStatus = cam === PRIMARY_CAMERA_SLOT
        ? (speaking ? `${camLabel} · toma fija` : 'En espera de voz…')
        : (speaking ? `${camLabel} · ${statusDetail || 'siguiendo voz'}` : `${camLabel} · en espera de rostro`)

      if (nextStatus !== statusRef.current) {
        statusRef.current = nextStatus
        setDirectorStatus(nextStatus)
      }
    } finally {
      isAnalyzingRef.current = false
    }
  }, [minCutSec, micThreshold, resolveSideTarget])

  useEffect(() => {
    if (!enabled) {
      cycleRef.current = { 0: null, 2: null }
      appliedCropRef.current = emptyCrops()
      setDirectorCrops(emptyCrops())
      setDirectorStatus('')
      statusRef.current = ''
      return undefined
    }

    // Intervalo relajado a 1.2s para fluidez total del video a 60fps sin saturar la CPU
    const id = setInterval(analyze, 1200)
    return () => clearInterval(id)
  }, [enabled, analyze])

  const getDirectorCrop = useCallback((slot) => {
    if (slot === PRIMARY_CAMERA_SLOT) return null
    const crop = directorCrops[slot]
    if (!crop || crop.zoom <= 1.02) return null
    return crop
  }, [directorCrops])

  return { directorCrops, getDirectorCrop, directorStatus }
}
