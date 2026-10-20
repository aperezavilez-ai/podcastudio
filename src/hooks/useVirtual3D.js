import { useEffect, useRef, useState, useCallback } from 'react'
import { Virtual3DEngine } from '../engine3d/Virtual3DEngine.js'
import * as THREE from 'three'

/**
 * Hook para gestionar escenarios virtuales 3D en PODCASTUDIO
 */
export function useVirtual3D({
  templateId,
  presenterStream,
  chromaEnabled = true,
  parallaxEnabled = true,
  quality = 'auto'
}) {
  const engineRef = useRef(null)
  const canvasRef = useRef(null)
  const outputStreamRef = useRef(null)
  const rafRef = useRef(null)
  const videoTextureRef = useRef(null)
  const videoElementRef = useRef(null)

  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ fps: 60, drawCalls: 0 })

  /**
   * Inicializar motor 3D
   */
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Virtual3DEngine(canvas, {
      width: 1920,
      height: 1080
    })

    engineRef.current = engine

    // Detectar y ajustar calidad
    if (quality === 'auto') {
      const tier = engine.detectGPUTier()
      engine.adjustQuality(tier)
    } else {
      engine.adjustQuality(quality)
    }

    console.log('[useVirtual3D] Motor 3D inicializado')

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      engine.dispose()
    }
  }, [quality])

  /**
   * Cargar escena GLTF según templateId
   */
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !templateId) return

    setLoading(true)
    setError(null)

    const sceneUrl = getSceneUrl(templateId)
    const sceneConfig = getSceneConfig(templateId)

    engine.loadScene(sceneUrl, sceneConfig, templateId)
      .then(() => {
        setReady(true)
        setLoading(false)
        console.log('[useVirtual3D] Escena cargada:', templateId)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
        console.error('[useVirtual3D] Error cargando escena:', err)
      })
  }, [templateId])

  /**
   * Setup video texture del presentador
   */
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !presenterStream || !ready) return

    // Crear elemento video
    const video = document.createElement('video')
    video.srcObject = presenterStream
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {})

    videoElementRef.current = video

    // Esperar a que el video esté listo
    const onVideoReady = () => {
      // Crear texture de Three.js
      const texture = new THREE.VideoTexture(video)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.format = THREE.RGBAFormat
      texture.colorSpace = THREE.SRGBColorSpace

      videoTextureRef.current = texture

      // Agregar plano del presentador
      const config = getPresenterConfig(templateId)
      engine.addPresenterPlane(texture, config)

      console.log('[useVirtual3D] Video texture del presentador configurada')
    }

    if (video.readyState >= 2) {
      onVideoReady()
    } else {
      video.addEventListener('loadeddata', onVideoReady, { once: true })
    }

    return () => {
      if (video) {
        video.srcObject = null
      }
      if (videoTextureRef.current) {
        videoTextureRef.current.dispose()
      }
    }
  }, [presenterStream, ready, templateId])

  /**
   * Loop de renderizado a 30fps
   */
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !ready) return

    const TARGET_FPS = 30
    const FRAME_TIME = 1000 / TARGET_FPS
    let lastFrameTime = 0

    const animate = (timestamp) => {
      const elapsed = timestamp - lastFrameTime

      if (elapsed >= FRAME_TIME - 1) {
        lastFrameTime = timestamp - (elapsed % FRAME_TIME)

        // Render frame
        engine.render()

        // Update stats (cada 30 frames)
        if (Math.random() < 0.033) {
          setStats({
            fps: Math.round(1000 / elapsed),
            drawCalls: engine.stats.drawCalls
          })
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [ready])

  /**
   * Capturar stream de salida
   */
  useEffect(() => {
    if (!canvasRef.current || !ready) return

    const stream = canvasRef.current.captureStream(30)

    // Aplicar contentHint='motion'
    const track = stream.getVideoTracks()[0]
    if (track) {
      try {
        track.contentHint = 'motion'
      } catch {}
    }

    outputStreamRef.current = stream
    console.log('[useVirtual3D] Stream de salida capturado')
  }, [ready])

  /**
   * Aplicar parallax (para integración futura con MediaPipe)
   */
  const applyParallax = useCallback((x, y) => {
    const engine = engineRef.current
    if (!engine || !parallaxEnabled) return

    engine.applyParallax(x, y, 0.3)
  }, [parallaxEnabled])

  return {
    canvasRef,
    outputStream: outputStreamRef.current,
    ready,
    loading,
    error,
    stats,
    engine: engineRef.current,
    applyParallax
  }
}

/**
 * Mapeo de template IDs a URLs de escenas (procedurales o GLTF)
 */
function getSceneUrl(templateId) {
  const scenes = {
    'news-3d': 'procedural:news',
    'interview-3d': 'procedural:talkshow',
    'tech-3d': 'procedural:tech',
    'concert-3d': 'procedural:concert',
    // Fallback a GLTF si existen
    'news-3d-gltf': '/sets3d/news-modern.glb',
    'interview-3d-gltf': '/sets3d/talkshow-warm.glb',
    'tech-3d-gltf': '/sets3d/tech-keynote.glb',
    'concert-3d-gltf': '/sets3d/concert-stage.glb'
  }
  return scenes[templateId] || scenes['news-3d']
}

/**
 * Configuración de iluminación por escena
 */
function getSceneConfig(templateId) {
  const configs = {
    'news-3d': {
      keyIntensity: 2.2,
      fillIntensity: 0.7,
      rimIntensity: 1.6,
      ambientIntensity: 0.3,
      shadowMapSize: 2048,
      envMapIntensity: 1.2
    },
    'interview-3d': {
      keyIntensity: 1.8,
      fillIntensity: 0.9,
      rimIntensity: 1.2,
      ambientIntensity: 0.4,
      shadowMapSize: 1024,
      envMapIntensity: 0.9
    },
    'tech-3d': {
      keyIntensity: 2.5,
      fillIntensity: 0.5,
      rimIntensity: 2.0,
      ambientIntensity: 0.2,
      shadowMapSize: 2048,
      envMapIntensity: 1.5
    },
    'concert-3d': {
      keyIntensity: 3.0,
      fillIntensity: 0.4,
      rimIntensity: 2.5,
      ambientIntensity: 0.15,
      shadowMapSize: 1024,
      envMapIntensity: 1.0
    }
  }
  return configs[templateId] || configs['news-3d']
}

/**
 * Configuración de posición del presentador por escena
 */
function getPresenterConfig(templateId) {
  const configs = {
    'news-3d': {
      x: 0.3,
      y: 1.2,
      z: 0,
      width: 1.6,
      height: 2.4
    },
    'interview-3d': {
      x: -0.5,
      y: 1.1,
      z: 0.2,
      width: 1.5,
      height: 2.3
    },
    'tech-3d': {
      x: 0,
      y: 1.3,
      z: 0,
      width: 1.7,
      height: 2.5
    },
    'concert-3d': {
      x: 0,
      y: 1.4,
      z: 0.5,
      width: 1.8,
      height: 2.6
    }
  }
  return configs[templateId] || configs['news-3d']
}
