import { useEffect, useRef, useState, useCallback } from 'react'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

const SHOT_ZOOM = { wide: 1, medium: 1.38, close: 1.85 }
const SHOT_ORDER = ['wide', 'medium', 'close']

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
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

export function useAIDirector({
  enabled,
  streams,
  micLevel,
  activeCamera,
  setActiveCamera,
  minCutSec = 4,
  shotCycleSec = 7,
  micThreshold = 12,
}) {
  const [directorCrop, setDirectorCrop] = useState({ focusX: 0.5, focusY: 0.42, zoom: 1 })
  const [directorStatus, setDirectorStatus] = useState('')
  const detectorRef = useRef(null)
  const videosRef = useRef({})
  const motionCtxRef = useRef(null)
  const prevMotionRef = useRef({})
  const lastSwitchRef = useRef(0)
  const shotStartRef = useRef(Date.now())
  const shotIndexRef = useRef(0)
  const smoothRef = useRef({ focusX: 0.5, focusY: 0.42, zoom: 1 })
  const faceMetaRef = useRef({})

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function init() {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM)
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
        })
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

    Object.keys(videosRef.current).forEach(key => {
      if (!streams[key]) delete videosRef.current[key]
    })
  }, [enabled, streams])

  const analyze = useCallback(() => {
    const detector = detectorRef.current
    const slots = [0, 1, 2].filter(i => streams[i] && videosRef.current[i]?.videoWidth)
    if (slots.length === 0) return

    if (!motionCtxRef.current) {
      const c = document.createElement('canvas')
      motionCtxRef.current = c.getContext('2d', { willReadFrequently: true })
    }
    const mctx = motionCtxRef.current
    const speaking = micLevel >= micThreshold
    const scores = {}
    const faces = {}

    for (const slot of slots) {
      const video = videosRef.current[slot]
      let faceScore = 0
      let fx = 0.5
      let fy = 0.42
      let motion = 0

      if (detector && video.readyState >= 2) {
        try {
          const result = detector.detectForVideo(video, performance.now())
          const det = result.detections?.[0]
          if (det?.boundingBox) {
            const bb = det.boundingBox
            const vw = video.videoWidth
            const vh = video.videoHeight
            fx = (bb.originX + bb.width / 2) / vw
            fy = (bb.originY + bb.height * 0.55) / vh
            faceScore = (bb.width * bb.height) / (vw * vh) * 8
            const mouthY = (bb.originY + bb.height * 0.72) / vh
            motion = sampleMotion(mctx, video, prevMotionRef.current[slot], {
              x: fx - bb.width / vw / 2,
              y: mouthY - 0.04,
              rw: bb.width / vw,
              rh: 0.12,
            })
            prevMotionRef.current[slot] = new Uint8ClampedArray(mctx.getImageData(0, 0, 80, 60).data)
          }
        } catch { /* skip frame */ }
      }

      const motionBoost = speaking ? motion * 2.2 : motion * 0.3
      scores[slot] = faceScore + motionBoost + (slot === activeCamera ? 0.15 : 0)
      faces[slot] = { fx, fy, faceScore, motion }
    }

    faceMetaRef.current = faces

    if (speaking && slots.length > 1) {
      const best = slots.reduce((a, b) => (scores[a] >= scores[b] ? a : b))
      const now = Date.now()
      const current = activeCamera ?? slots[0]

      if (best !== current && scores[best] > scores[current] * 1.2 && now - lastSwitchRef.current > minCutSec * 1000) {
        setActiveCamera(best)
        lastSwitchRef.current = now
        shotStartRef.current = now
        shotIndexRef.current = 0
      }
    }

    const cam = activeCamera ?? slots[0]
    const face = faces[cam]
    let targetZoom = SHOT_ZOOM.wide
    let targetFx = face?.fx ?? 0.5
    let targetFy = face?.fy ?? 0.42

    if (speaking && face?.faceScore > 0.1) {
      const elapsed = Date.now() - shotStartRef.current
      if (elapsed > shotCycleSec * 1000) {
        shotIndexRef.current = (shotIndexRef.current + 1) % SHOT_ORDER.length
        shotStartRef.current = Date.now()
      }
      targetZoom = SHOT_ZOOM[SHOT_ORDER[shotIndexRef.current]]
    }

    const smooth = smoothRef.current
    smooth.focusX += (targetFx - smooth.focusX) * 0.12
    smooth.focusY += (targetFy - smooth.focusY) * 0.12
    smooth.zoom += (targetZoom - smooth.zoom) * 0.06

    setDirectorCrop({ focusX: smooth.focusX, focusY: smooth.focusY, zoom: smooth.zoom })

    const shotName = SHOT_ORDER[shotIndexRef.current]
    const shotLabels = { wide: 'General', medium: 'Medio', close: 'Primer plano' }
    setDirectorStatus(
      speaking
        ? `Cam ${cam + 1} · ${shotLabels[shotName]}${slots.length > 1 ? ' · siguiendo voz' : ''}`
        : 'En espera de voz...',
    )
  }, [streams, micLevel, activeCamera, setActiveCamera, minCutSec, shotCycleSec, micThreshold])

  useEffect(() => {
    if (!enabled) {
      setDirectorCrop({ focusX: 0.5, focusY: 0.42, zoom: 1 })
      setDirectorStatus('')
      return
    }
    const id = setInterval(analyze, 650)
    return () => clearInterval(id)
  }, [enabled, analyze])

  return { directorCrop, directorStatus }
}
