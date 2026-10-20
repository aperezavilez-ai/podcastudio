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
   * Carga una escena GLTF con setup automático o fallback a estudio procedural 3D broadcast
   */
  async loadScene(gltfUrl, sceneConfig = {}, templateId = 'news-3d') {
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

      console.log('[3D Engine] Escena GLTF cargada:', gltfUrl)
      return gltf
    } catch (error) {
      console.warn('[3D Engine] GLTF no disponible en red (' + gltfUrl + '), activando estudio 3D procedural broadcast:', error.message)
      const studioScene = this.buildProceduralStudio(templateId, sceneConfig)
      this.setupSceneLights(sceneConfig)
      return { scene: studioScene }
    }
  }

  /**
   * Generador de Escenario Virtual 3D Broadcast Procedural Hiperrealista
   * Garantiza renderizado 3D inmediato a 60 FPS con iluminación PBR, reflejos y sombras
   */
  buildProceduralStudio(templateId = 'news-3d', sceneConfig = {}) {
    if (this.currentScene) {
      this.scene.remove(this.currentScene)
      this.disposeObject(this.currentScene)
    }

    const studioGroup = new THREE.Group()
    studioGroup.name = `procedural-studio-${templateId}`

    const isWood = templateId === 'interview-3d'
    const isTech = templateId === 'tech-3d'
    const isConcert = templateId === 'concert-3d'

    // 1. Suelo de estudio hiperrealista con reflejos especulares
    const floorGeo = new THREE.PlaneGeometry(30, 30)
    const floorColor = isWood ? 0x221a15 : isTech ? 0x080c14 : isConcert ? 0x0a0a0f : 0x0c101a
    const floorRoughness = isWood ? 0.35 : isTech ? 0.12 : isConcert ? 0.25 : 0.15
    const floorMetalness = isWood ? 0.05 : isTech ? 0.85 : isConcert ? 0.6 : 0.75

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: floorRoughness,
      metalness: floorMetalness,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    floor.receiveShadow = true
    studioGroup.add(floor)

    // 2. Plataforma de estudio principal (Riser / Stage)
    const stageRadius = isTech ? 5.5 : 4.5
    const stageGeo = new THREE.CylinderGeometry(stageRadius, stageRadius + 0.3, 0.18, 48)
    const stageMat = new THREE.MeshStandardMaterial({
      color: isTech ? 0x111624 : 0x141822,
      roughness: 0.2,
      metalness: 0.8,
    })
    const stage = new THREE.Mesh(stageGeo, stageMat)
    stage.position.set(0, 0.09, 0)
    stage.receiveShadow = true
    stage.castShadow = true
    studioGroup.add(stage)

    // Borde LED luminoso en el perímetro de la tarima
    const ringGeo = new THREE.TorusGeometry(stageRadius + 0.1, 0.03, 16, 64)
    const ringColor = isWood ? 0xff9933 : isTech ? 0x00f2fe : isConcert ? 0xff0077 : 0x2563eb
    const ringMat = new THREE.MeshBasicMaterial({ color: ringColor })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0.18, 0)
    studioGroup.add(ring)

    // 3. Videowall LED Curvo de fondo (Curved LED Wall)
    const wallRadius = 9
    const wallHeight = 5.5
    const wallArc = Math.PI * 0.75
    const wallGeo = new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, 48, 1, true, -wallArc / 2, wallArc)

    const wallEmissive = isWood ? 0x331c0d : isTech ? 0x003366 : isConcert ? 0x330033 : 0x0c2759
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      emissive: wallEmissive,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      metalness: 0.4,
      side: THREE.BackSide,
    })
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.position.set(0, wallHeight / 2, -1.5)
    wall.receiveShadow = true
    studioGroup.add(wall)

    // Friso LED superior e inferior del videowall
    const frameGeo = new THREE.TorusGeometry(wallRadius, 0.06, 16, 48, wallArc)
    const frameMat = new THREE.MeshBasicMaterial({ color: ringColor })
    const topFrame = new THREE.Mesh(frameGeo, frameMat)
    topFrame.rotation.x = Math.PI / 2
    topFrame.position.set(0, wallHeight + 0.03, -1.5)
    studioGroup.add(topFrame)

    const bottomFrame = new THREE.Mesh(frameGeo, frameMat)
    bottomFrame.rotation.x = Math.PI / 2
    bottomFrame.position.set(0, 0.05, -1.5)
    studioGroup.add(bottomFrame)

    // 4. Columnas arquitectónicas laterales
    const colGeo = new THREE.CylinderGeometry(0.35, 0.35, 6, 24)
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.3,
      metalness: 0.8,
    })
    const colPositions = [
      [-5.5, 3, -1],
      [5.5, 3, -1],
      [-7.5, 3, 2],
      [7.5, 3, 2],
    ]
    colPositions.forEach(([cx, cy, cz]) => {
      const col = new THREE.Mesh(colGeo, colMat)
      col.position.set(cx, cy, cz)
      col.castShadow = true
      col.receiveShadow = true
      studioGroup.add(col)

      const stripGeo = new THREE.BoxGeometry(0.04, 5.8, 0.04)
      const stripMat = new THREE.MeshBasicMaterial({ color: ringColor })
      const strip = new THREE.Mesh(stripGeo, stripMat)
      strip.position.set(cx, cy, cz + 0.36)
      studioGroup.add(strip)
    })

    // 5. Escritorio Broadcast Virtual (Presenter Desk)
    if (templateId === 'news-3d' || templateId === 'interview-3d') {
      const deskShape = new THREE.CylinderGeometry(1.4, 1.4, 0.75, 32, 1, false, -Math.PI * 0.4, Math.PI * 0.8)
      const deskMat = new THREE.MeshStandardMaterial({
        color: isWood ? 0x2e1e12 : 0x111827,
        roughness: 0.15,
        metalness: isWood ? 0.1 : 0.85,
      })
      const desk = new THREE.Mesh(deskShape, deskMat)
      desk.position.set(0, 0.375, 0.9)
      desk.castShadow = true
      desk.receiveShadow = true
      studioGroup.add(desk)

      const deskLedGeo = new THREE.TorusGeometry(1.41, 0.025, 16, 32, Math.PI * 0.8)
      const deskLedMat = new THREE.MeshBasicMaterial({ color: ringColor })
      const deskLed = new THREE.Mesh(deskLedGeo, deskLedMat)
      deskLed.rotation.x = Math.PI / 2
      deskLed.position.set(0, 0.74, 0.9)
      studioGroup.add(deskLed)
    }

    // 6. Truss / Estructura superior de iluminación de estudio
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.2 })
    const trussBarGeo = new THREE.BoxGeometry(16, 0.15, 0.15)
    const truss1 = new THREE.Mesh(trussBarGeo, trussMat)
    truss1.position.set(0, 5.8, 0)
    studioGroup.add(truss1)

    const truss2 = new THREE.Mesh(trussBarGeo, trussMat)
    truss2.position.set(0, 5.8, -2.5)
    studioGroup.add(truss2)

    this.currentScene = studioGroup
    this.scene.add(studioGroup)
    return studioGroup
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
