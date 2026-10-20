/**
 * PODCASTUDIO - Motor de Escenarios Virtuales 3D Profesional
 * Basado en Three.js para sets broadcast en tiempo real
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export class Virtual3DEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.width = options.width || 1920
    this.height = options.height || 1080

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0e)

    // Camera setup - Broadcast style
    this.camera = new THREE.PerspectiveCamera(
      50, // FOV típico de broadcast
      this.width / this.height,
      0.1,
      100
    )
    this.camera.position.set(0, 1.6, 5) // Altura de ojos humanos
    this.camera.lookAt(0, 1.2, 0)

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    })

    this.renderer.setSize(this.width, this.height, false)
    this.renderer.setPixelRatio(1) // Fixed 1:1 para streaming

    // Shadow mapping profesional
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Tone mapping broadcast
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // Loaders
    this.gltfLoader = new GLTFLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
    this.gltfLoader.setDRACOLoader(dracoLoader)

    // State
    this.currentScene = null
    this.presenterPlane = null
    this.lights = []
    this.mixer = null
    this.clock = new THREE.Clock()

    // Performance monitoring
    this.stats = {
      fps: 60,
      frameTime: 0,
      drawCalls: 0
    }
  }

  /**
   * Carga una escena GLTF con setup automático
   */
  async loadScene(gltfUrl, sceneConfig = {}) {
    try {
      const gltf = await this.gltfLoader.loadAsync(gltfUrl)

      // Remover escena anterior
      if (this.currentScene) {
        this.scene.remove(this.currentScene)
        this.disposeObject(this.currentScene)
      }

      this.currentScene = gltf.scene
      this.scene.add(this.currentScene)

      // Setup automático de sombras
      this.currentScene.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true

          // Optimización de materiales
          if (child.material) {
            child.material.envMapIntensity = sceneConfig.envMapIntensity || 1.0
          }
        }
      })

      // Setup de animaciones si existen
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.currentScene)
        gltf.animations.forEach(clip => {
          const action = this.mixer.clipAction(clip)
          action.play()
        })
      }

      // Setup de luces si la escena las define
      this.setupSceneLights(sceneConfig)

      console.log('[3D Engine] Escena cargada:', gltfUrl)
      return gltf
    } catch (error) {
      console.error('[3D Engine] Error cargando escena:', error)
      throw error
    }
  }

  /**
   * Setup de iluminación broadcast profesional (3-point lighting)
   */
  setupSceneLights(config = {}) {
    // Limpiar luces anteriores
    this.lights.forEach(light => this.scene.remove(light))
    this.lights = []

    // Key Light (luz principal) - 45° arriba y a la izquierda
    const keyLight = new THREE.DirectionalLight(0xffffff, config.keyIntensity || 2.0)
    keyLight.position.set(5, 8, 3)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = config.shadowMapSize || 2048
    keyLight.shadow.mapSize.height = config.shadowMapSize || 2048
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 50
    keyLight.shadow.camera.left = -10
    keyLight.shadow.camera.right = 10
    keyLight.shadow.camera.top = 10
    keyLight.shadow.camera.bottom = -10
    keyLight.shadow.bias = -0.001
    keyLight.shadow.radius = 4 // Sombras suaves
    this.scene.add(keyLight)
    this.lights.push(keyLight)

    // Fill Light (luz de relleno) - Opuesta al key, más suave
    const fillLight = new THREE.DirectionalLight(0xffffff, config.fillIntensity || 0.6)
    fillLight.position.set(-3, 5, 2)
    this.scene.add(fillLight)
    this.lights.push(fillLight)

    // Rim Light (contorno) - Desde atrás para separar del fondo
    const rimLight = new THREE.SpotLight(0xffffff, config.rimIntensity || 1.5)
    rimLight.position.set(0, 6, -5)
    rimLight.angle = Math.PI / 6
    rimLight.penumbra = 0.5
    rimLight.decay = 2
    this.scene.add(rimLight)
    this.lights.push(rimLight)

    // Ambient light suave para evitar negros absolutos
    const ambientLight = new THREE.AmbientLight(0xffffff, config.ambientIntensity || 0.3)
    this.scene.add(ambientLight)
    this.lights.push(ambientLight)
  }

  /**
   * Agrega el plano del presentador con video texture
   */
  addPresenterPlane(videoTexture, config = {}) {
    // Remover plano anterior si existe
    if (this.presenterPlane) {
      this.scene.remove(this.presenterPlane)
      this.disposeObject(this.presenterPlane)
    }

    // Geometry: aspect ratio típico de persona (2:3)
    const width = config.width || 1.6
    const height = config.height || 2.4
    const geometry = new THREE.PlaneGeometry(width, height)

    // Material con transparencia para chroma key
    const material = new THREE.MeshBasicMaterial({
      map: videoTexture,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.1 // Eliminar píxeles casi transparentes
    })

    const plane = new THREE.Mesh(geometry, material)
    plane.castShadow = true
    plane.receiveShadow = false

    // Posición: centrado en escena, altura natural
    plane.position.set(
      config.x || 0,
      config.y || 1.2, // Altura promedio del torso
      config.z || 0
    )

    this.presenterPlane = plane
    this.scene.add(plane)

    console.log('[3D Engine] Plano de presentador agregado')
    return plane
  }

  /**
   * Actualiza la posición de la cámara (para parallax)
   */
  updateCameraPosition(x, y, z, lookAt = null) {
    this.camera.position.set(x, y, z)
    if (lookAt) {
      this.camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
    } else if (this.presenterPlane) {
      this.camera.lookAt(this.presenterPlane.position)
    }
  }

  /**
   * Aplica parallax sutil basado en posición del presentador
   */
  applyParallax(parallaxX, parallaxY, intensity = 0.3) {
    const basePos = this.camera.position.clone()
    this.camera.position.x += parallaxX * intensity
    this.camera.position.y += parallaxY * (intensity * 0.7) // Menos movimiento vertical

    if (this.presenterPlane) {
      this.camera.lookAt(this.presenterPlane.position)
    }
  }

  /**
   * Render frame
   */
  render() {
    const delta = this.clock.getDelta()

    // Update animaciones
    if (this.mixer) {
      this.mixer.update(delta)
    }

    // Render
    this.renderer.render(this.scene, this.camera)

    // Stats
    this.stats.frameTime = delta * 1000
    this.stats.drawCalls = this.renderer.info.render.calls
  }

  /**
   * Resize handler
   */
  resize(width, height) {
    this.width = width
    this.height = height
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  /**
   * Dispose completo de recursos
   */
  dispose() {
    // Dispose scene
    if (this.currentScene) {
      this.disposeObject(this.currentScene)
    }

    // Dispose presenter plane
    if (this.presenterPlane) {
      this.disposeObject(this.presenterPlane)
    }

    // Dispose renderer
    this.renderer.dispose()

    console.log('[3D Engine] Engine disposed')
  }

  /**
   * Helper: dispose recursivo de objetos 3D
   */
  disposeObject(obj) {
    if (!obj) return

    obj.traverse(child => {
      if (child.geometry) {
        child.geometry.dispose()
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => this.disposeMaterial(mat))
        } else {
          this.disposeMaterial(child.material)
        }
      }
    })
  }

  disposeMaterial(material) {
    if (!material) return

    // Dispose textures
    Object.keys(material).forEach(key => {
      const value = material[key]
      if (value && value.isTexture) {
        value.dispose()
      }
    })

    material.dispose()
  }

  /**
   * Detecta tier de GPU para ajustar calidad
   */
  detectGPUTier() {
    const gl = this.renderer.getContext()
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')

    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      console.log('[3D Engine] GPU:', renderer)

      // Detección simple
      if (renderer.includes('RTX') || renderer.includes('RX 6')) return 'high'
      if (renderer.includes('GTX') || renderer.includes('RX 5')) return 'medium'
      if (renderer.includes('Intel')) return 'low'
    }

    return 'medium'
  }

  /**
   * Ajusta calidad según GPU
   */
  adjustQuality(tier = 'medium') {
    switch (tier) {
      case 'high':
        this.renderer.shadowMap.enabled = true
        this.lights.forEach(light => {
          if (light.shadow) light.shadow.mapSize.set(2048, 2048)
        })
        break

      case 'medium':
        this.renderer.shadowMap.enabled = true
        this.lights.forEach(light => {
          if (light.shadow) light.shadow.mapSize.set(1024, 1024)
        })
        break

      case 'low':
        this.renderer.shadowMap.enabled = false
        break
    }

    console.log('[3D Engine] Calidad ajustada a:', tier)
  }
}
