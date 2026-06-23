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
    // Plano lejano → hombros y cabeza
    zoom = clamp(0.28 / faceWRatio, 1.22, 1.42)
  } else if (faceWRatio < 0.18) {
    // Plano medio → cabeza completa
    zoom = clamp(0.34 / faceWRatio, 1.42, 1.68)
  } else {
    // Plano cercano → rostro
    zoom = clamp(0.52 / faceWRatio, 1.65, 2.05)
  }

  return { focusX: fx, focusY: fy, zoom }
}

function sampleMotion(ctx, video, prevData, region) {
  if (!video?.videoWidth) return 0
  const w = 80
  const h = 60
  const canvas = ctx.canvas
  if (canvas.width !== w) { canvas.width = w; canvas.height = h }
  const { x, y, rw, rh } = region
  const sx = clamp(x * video.videoWidth, 0, video.videoWidth - 1)
  const sy = clamp(y * video.videoHeight, 0, video.videoHeight - 1)
  const sw = Math.max(8, rw * video.videoWidth)
  const sh = Math.max(8, rh * video.videoHeight)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  if (!prevData) return 0
  let diff = 0
  for (let i = 0; i < data.length; i += 4) {
    diff += Math.abs(data[i] - prevData[i]) + Math.abs(data[i + 1] - prevData[i + 1])
  }
  return diff / (w * h * 3)
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
  const motionCtxRef = useRef(null)
  const prevMotionRef = useRef({})
  const lastSwitchRef = useRef(0)
  const cycleRef = useRef({ 0: null, 2: null })
  const appliedCropRef = useRef(emptyCrops())

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function init() {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM)
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
        console.error('Director IA init:', e)
      }
    }

    init()
    return () => {
      cancelled = true
      detectorRef.current?.close?.()
      detectorRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    Object.entries(streams).forEach(([slot, stream]) => {
      const i = Number(slot)
      if (!stream) return
      if (!videosRef.current[i]) {
        const v = document.createElement('video')
        v.muted = true
        v.playsInline = true
        v.autoplay = true
        videosRef.current[i] = v
      }
      const track = stream.getVideoTracks()[0]
      const feed = track ? new MediaStream([track.clone?.() ?? track]) : stream
      if (videosRef.current[i].srcObject !== feed) {
        videosRef.current[i].srcObject = feed
      }
      videosRef.current[i].play().catch(() => {})
    })

    Object.keys(videosRef.current).forEach((key) => {
      if (!streams[key]) delete videosRef.current[key]
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

    // Plano general — sin zoom, sin deslizamiento
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

  const analyze = useCallback(() => {
    const detector = detectorRef.current
    const slots = [0, 1, 2].filter((i) => streams[i] && videosRef.current[i]?.videoWidth)
    if (slots.length === 0) return

    if (!motionCtxRef.current) {
      const c = document.createElement('canvas')
      motionCtxRef.current = c.getContext('2d', { willReadFrequently: true })
    }
    const mctx = motionCtxRef.current
    const speaking = micLevel >= micThreshold
    const scores = {}
    const faces = {}
    const now = Date.now()

    for (const slot of slots) {
      const video = videosRef.current[slot]
      let faceScore = 0
      let fx = 0.5
      let fy = 0.42
      let motion = 0
      let boundingBox = null
      const vw = video.videoWidth
      const vh = video.videoHeight

      if (detector && video.readyState >= 2) {
        try {
          const result = detector.detectForVideo(video, performance.now())
          const det = result.detections?.[0]
          if (det?.boundingBox) {
            boundingBox = det.boundingBox
            fx = (boundingBox.originX + boundingBox.width / 2) / vw
            fy = (boundingBox.originY + boundingBox.height * 0.55) / vh
            faceScore = (boundingBox.width * boundingBox.height) / (vw * vh) * 8
            const mouthY = (boundingBox.originY + boundingBox.height * 0.72) / vh
            motion = sampleMotion(mctx, video, prevMotionRef.current[slot], {
              x: fx - boundingBox.width / vw / 2,
              y: mouthY - 0.04,
              rw: boundingBox.width / vw,
              rh: 0.12,
            })
            prevMotionRef.current[slot] = new Uint8ClampedArray(mctx.getImageData(0, 0, 80, 60).data)
          }
        } catch { /* skip frame */ }
      }

      const motionBoost = speaking ? motion * 2.2 : motion * 0.3
      scores[slot] = faceScore + motionBoost + (slot === activeCamera ? 0.15 : 0)
      faces[slot] = { fx, fy, faceScore, motion, boundingBox, videoWidth: vw, videoHeight: vh }
    }

    if (speaking && slots.length > 1) {
      const sideActive = SIDE_SLOTS.filter((s) => streams[s])
      const pool = sideActive.length > 0 ? sideActive : slots.filter((s) => s !== PRIMARY_CAMERA_SLOT)
      const best = pool.reduce((a, b) => (scores[a] >= scores[b] ? a : b))
      const current = activeCamera ?? PRIMARY_CAMERA_SLOT

      if (
        best !== current
        && scores[best] > (scores[current] ?? 0) * 1.15
        && now - lastSwitchRef.current > minCutSec * 1000
      ) {
        setActiveCamera(best)
        lastSwitchRef.current = now
      }
    }

    const nextCrops = emptyCrops()
    let statusDetail = ''

    for (const slot of [0, 1, 2]) {
      // MASTER: siempre plano general, sin zoom
      if (slot === PRIMARY_CAMERA_SLOT || !streams[slot]) {
        nextCrops[slot] = { ...DEFAULT_CROP }
        appliedCropRef.current[slot] = { ...DEFAULT_CROP }
        continue
      }

      const { crop, status } = resolveSideTarget(slot, faces[slot], now)
      if (slot === (activeCamera ?? PRIMARY_CAMERA_SLOT)) statusDetail = status

      // Corte directo: sin interpolación tipo slider
      nextCrops[slot] = { ...crop }
      appliedCropRef.current[slot] = { ...crop }
    }

    setDirectorCrops(nextCrops)

    const cam = activeCamera ?? PRIMARY_CAMERA_SLOT
    const camLabel = slotLabel(cam)
    if (cam === PRIMARY_CAMERA_SLOT) {
      setDirectorStatus(speaking ? `${camLabel} · toma fija` : 'En espera de voz…')
    } else {
      setDirectorStatus(
        speaking
          ? `${camLabel} · ${statusDetail || 'siguiendo voz'}`
          : `${camLabel} · en espera de rostro`,
      )
    }
  }, [streams, micLevel, activeCamera, setActiveCamera, minCutSec, micThreshold, resolveSideTarget])

  useEffect(() => {
    if (!enabled) {
      cycleRef.current = { 0: null, 2: null }
      appliedCropRef.current = emptyCrops()
      setDirectorCrops(emptyCrops())
      setDirectorStatus('')
      return
    }
    const id = setInterval(analyze, 650)
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
