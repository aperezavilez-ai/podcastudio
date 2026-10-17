import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

let segmenterInstance = null
let initPromise = null
let isReady = false
let initError = null

/**
 * Inicializa y reutiliza el modelo de segmentación de personas de MediaPipe (Selfie Segmenter).
 * Utiliza aceleración por GPU (WebGL) y cae a CPU en caso de no estar disponible.
 */
export async function getSegmentationEngine() {
  if (segmenterInstance) return segmenterInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL)
      try {
        segmenterInstance = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        })
      } catch (gpuErr) {
        console.warn('Fallback a CPU para segmentación:', gpuErr)
        segmenterInstance = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        })
      }
      isReady = true
      return segmenterInstance
    } catch (err) {
      initError = err
      console.error('Error cargando MediaPipe Selfie Segmenter:', err)
      throw err
    }
  })()

  return initPromise
}

export function isSegmentationReady() {
  return isReady && segmenterInstance !== null
}

let maskCanvas = null
let maskCtx = null
let lastTimestamp = 0
let smoothedFloats = null

/**
 * Procesa un fotograma de video y genera una máscara alfa precisa y estabilizada de la persona.
 * Devuelve un Canvas con la máscara (blanco = persona opaca, transparente = habitación borrada).
 */
export function segmentPersonFromVideo(video, options = {}) {
  if (!segmenterInstance || !video || video.readyState < 2 || !video.videoWidth) {
    return null
  }

  const {
    threshold = 0.38,       // Umbral calibrado para no amputar ropa oscura, sillas ni cabello
    smoothness = 0.28,      // Ancho de transición suave
    temporalSmoothing = 0.70 // Factor EMA anti-parpadeo (0 = sin suavizado temporal, 0.85 = ultra estable)
  } = options

  // En modo VIDEO de MediaPipe, la marca de tiempo debe ser estrictamente creciente
  let now = performance.now()
  if (now <= lastTimestamp) {
    now = lastTimestamp + 1
  }
  lastTimestamp = now

  try {
    const result = segmenterInstance.segmentForVideo(video, now)
    const confidenceMask = result.confidenceMasks?.[0]
    if (!confidenceMask) return null

    const mw = confidenceMask.width
    const mh = confidenceMask.height
    const floats = confidenceMask.getAsFloat32Array()

    // Estabilizador temporal EMA: suprime completamente el ruido y saltos entre cuadros
    if (!smoothedFloats || smoothedFloats.length !== floats.length) {
      smoothedFloats = new Float32Array(floats)
    } else {
      const alpha = Math.max(0, Math.min(0.92, temporalSmoothing))
      const invAlpha = 1 - alpha
      for (let i = 0; i < floats.length; i++) {
        smoothedFloats[i] = smoothedFloats[i] * alpha + floats[i] * invAlpha
      }
    }

    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas')
      maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })
    }

    if (maskCanvas.width !== mw || maskCanvas.height !== mh) {
      maskCanvas.width = mw
      maskCanvas.height = mh
    }

    const imgData = maskCtx.createImageData(mw, mh)
    const data = imgData.data

    const edge0 = Math.max(0, threshold - smoothness * 0.45)
    const edge1 = Math.min(1, threshold + smoothness * 0.45)
    const range = Math.max(0.001, edge1 - edge0)

    for (let i = 0; i < smoothedFloats.length; i++) {
      const conf = smoothedFloats[i]
      // Función Hermite suave cúbica (smoothstep) para bordes orgánicos broadcast
      let alphaVal = 0
      if (conf >= edge1) {
        alphaVal = 255
      } else if (conf > edge0) {
        const t = (conf - edge0) / range
        alphaVal = Math.round((t * t * (3 - 2 * t)) * 255)
      }

      const idx = i * 4
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = alphaVal
    }

    maskCtx.putImageData(imgData, 0, 0)
    return maskCanvas
  } catch (err) {
    return null
  }
}
