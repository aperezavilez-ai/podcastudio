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

/**
 * Procesa un fotograma de video y genera una máscara alfa precisa de la persona.
 * Devuelve un Canvas con la máscara (blanco = persona opaca, transparente = habitación borrada).
 */
export function segmentPersonFromVideo(video, options = {}) {
  if (!segmenterInstance || !video || video.readyState < 2 || !video.videoWidth) {
    return null
  }

  const {
    threshold = 0.5,
    smoothness = 0.25,
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

    const edge0 = Math.max(0, threshold - smoothness * 0.4)
    const edge1 = Math.min(1, threshold + smoothness * 0.4)
    const range = Math.max(0.001, edge1 - edge0)

    for (let i = 0; i < floats.length; i++) {
      const conf = floats[i]
      // Función Hermite suave (smoothstep) para evitar dientes de sierra en cabello y hombros
      let alpha = 0
      if (conf >= edge1) {
        alpha = 255
      } else if (conf > edge0) {
        const t = (conf - edge0) / range
        alpha = Math.round((t * t * (3 - 2 * t)) * 255)
      }

      const idx = i * 4
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = alpha
    }

    maskCtx.putImageData(imgData, 0, 0)
    return maskCanvas
  } catch (err) {
    return null
  }
}
