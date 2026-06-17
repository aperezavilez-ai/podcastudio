import { useEffect, useRef, useCallback } from 'react'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

export function usePersonSegmentation(enabled) {
  const segmenterRef = useRef(null)
  const readyRef = useRef(false)
  const loadingRef = useRef(false)
  const maskCanvasRef = useRef(null)
  const maskCtxRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    loadingRef.current = true

    async function init() {
      try {
        const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM)
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        })
        if (!cancelled) {
          segmenterRef.current = segmenter
          readyRef.current = true
        }
      } catch (e) {
        console.error('Segmentation init:', e)
      } finally {
        loadingRef.current = false
      }
    }

    init()
    return () => {
      cancelled = true
      segmenterRef.current?.close?.()
      segmenterRef.current = null
      readyRef.current = false
    }
  }, [enabled])

  const processFrame = useCallback((video, timestamp) => {
    const seg = segmenterRef.current
    if (!seg || !video?.videoWidth) return null

    try {
      const result = seg.segmentForVideo(video, timestamp)
      const mask = result.confidenceMasks?.[0]
      if (!mask) return null

      const w = mask.width
      const h = mask.height
      const floats = mask.getAsFloat32Array()

      if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas')
        maskCtxRef.current = maskCanvasRef.current.getContext('2d')
      }
      const mc = maskCanvasRef.current
      const mctx = maskCtxRef.current
      if (mc.width !== w || mc.height !== h) {
        mc.width = w
        mc.height = h
      }

      const imgData = mctx.createImageData(w, h)
      for (let i = 0; i < floats.length; i++) {
        const v = Math.round(floats[i] * 255)
        const j = i * 4
        imgData.data[j] = 255
        imgData.data[j + 1] = 255
        imgData.data[j + 2] = 255
        imgData.data[j + 3] = v
      }
      mctx.putImageData(imgData, 0, 0)
      return maskCanvasRef.current
    } catch {
      return null
    }
  }, [])

  return {
    processFrame,
    isReady: () => readyRef.current,
    isLoading: () => loadingRef.current,
  }
}
