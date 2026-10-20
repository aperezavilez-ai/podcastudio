/**
 * Generador procedimental de escenarios 3D broadcast profesionales
 * Crea sets en tiempo real sin necesidad de archivos GLTF externos
 */

import * as THREE from 'three'

/**
 * Crea un estudio de noticias broadcast profesional
 */
export function createNewsStudio3D(scene) {
  const studio = new THREE.Group()
  studio.name = 'NewsStudio'

  // === SUELO REFLECTANTE ===
  const floorGeometry = new THREE.PlaneGeometry(20, 20)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.2,
    metalness: 0.8,
    envMapIntensity: 1.5
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  studio.add(floor)

  // === VIDEOWALL LED (fondo) ===
  const videowallGeometry = new THREE.BoxGeometry(8, 4.5, 0.1)
  const videowallMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.9
  })
  const videowall = new THREE.Mesh(videowallGeometry, videowallMaterial)
  videowall.position.set(0, 2.5, -6)
  videowall.castShadow = true
  studio.add(videowall)

  // Grid animado en el videowall
  const gridTexture = createGridTexture()
  videowallMaterial.emissiveMap = gridTexture
  videowallMaterial.needsUpdate = true

  // === ESCRITORIO DE NOTICIAS ===
  const deskGeometry = new THREE.BoxGeometry(3, 0.8, 1.2)
  const deskMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.3,
    metalness: 0.7
  })
  const desk = new THREE.Mesh(deskGeometry, deskMaterial)
  desk.position.set(0, 0.4, -2)
  desk.castShadow = true
  desk.receiveShadow = true
  studio.add(desk)

  // Logo del escritorio
  const logoGeometry = new THREE.BoxGeometry(0.4, 0.05, 0.3)
  const logoMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.5
  })
  const logo = new THREE.Mesh(logoGeometry, logoMaterial)
  logo.position.set(-1, 0.83, -2)
  studio.add(logo)

  // === COLUMNAS ARQUITECTÓNICAS ===
  const columnGeometry = new THREE.CylinderGeometry(0.2, 0.2, 5, 16)
  const columnMaterial = new THREE.MeshStandardMaterial({
    color: 0x374151,
    roughness: 0.6,
    metalness: 0.4
  })

  // Columnas laterales
  for (let i = 0; i < 4; i++) {
    const column = new THREE.Mesh(columnGeometry, columnMaterial)
    const x = i < 2 ? -4 : 4
    const z = i % 2 === 0 ? -3 : -5
    column.position.set(x, 2.5, z)
    column.castShadow = true
    studio.add(column)
  }

  // === PANELES LED LATERALES ===
  const sidePanelGeometry = new THREE.BoxGeometry(0.1, 3, 2)
  const sidePanelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.3
  })

  const leftPanel = new THREE.Mesh(sidePanelGeometry, sidePanelMaterial)
  leftPanel.position.set(-4.5, 1.8, -4)
  studio.add(leftPanel)

  const rightPanel = leftPanel.clone()
  rightPanel.position.set(4.5, 1.8, -4)
  studio.add(rightPanel)

  // === LUCES DE ACENTO ===
  // Rim lights (contorno)
  const rimLight1 = new THREE.PointLight(0x3b82f6, 2, 10)
  rimLight1.position.set(-3, 3, -2)
  studio.add(rimLight1)

  const rimLight2 = new THREE.PointLight(0x3b82f6, 2, 10)
  rimLight2.position.set(3, 3, -2)
  studio.add(rimLight2)

  scene.add(studio)
  return studio
}

/**
 * Crea un set de talk show / entrevista
 */
export function createTalkShowStudio3D(scene) {
  const studio = new THREE.Group()
  studio.name = 'TalkShowStudio'

  // === SUELO DE MADERA ===
  const floorGeometry = new THREE.PlaneGeometry(20, 20)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.7,
    metalness: 0.1
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  studio.add(floor)

  // === PARED CON TEXTURA LADRILLO ===
  const wallGeometry = new THREE.PlaneGeometry(12, 5)
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b7355,
    roughness: 0.9,
    metalness: 0.0
  })
  const wall = new THREE.Mesh(wallGeometry, wallMaterial)
  wall.position.set(0, 2.5, -6)
  wall.receiveShadow = true
  studio.add(wall)

  // === SOFÁ ===
  const sofaGeometry = new THREE.BoxGeometry(2.5, 0.6, 1)
  const sofaMaterial = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.8,
    metalness: 0.0
  })
  const sofa = new THREE.Mesh(sofaGeometry, sofaMaterial)
  sofa.position.set(-1.5, 0.3, -3)
  sofa.castShadow = true
  sofa.receiveShadow = true
  studio.add(sofa)

  // Respaldo del sofá
  const backGeometry = new THREE.BoxGeometry(2.5, 0.8, 0.2)
  const back = new THREE.Mesh(backGeometry, sofaMaterial)
  back.position.set(-1.5, 0.7, -3.4)
  back.castShadow = true
  studio.add(back)

  // === MESA DE CENTRO ===
  const tableGeometry = new THREE.BoxGeometry(1.2, 0.1, 0.6)
  const tableMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.2,
    metalness: 0.5
  })
  const table = new THREE.Mesh(tableGeometry, tableMaterial)
  table.position.set(0, 0.5, -1.5)
  table.castShadow = true
  table.receiveShadow = true
  studio.add(table)

  // Patas de la mesa
  const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8)
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.3,
    metalness: 0.8
  })

  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(legGeometry, legMaterial)
    const x = i < 2 ? -0.5 : 0.5
    const z = i % 2 === 0 ? -0.2 : 0.2
    leg.position.set(x, 0.25, -1.5 + z)
    studio.add(leg)
  }

  // === LIBRERÍA ===
  const shelfGeometry = new THREE.BoxGeometry(3, 0.05, 0.3)
  const shelfMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.7
  })

  for (let i = 0; i < 4; i++) {
    const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial)
    shelf.position.set(3, 0.5 + i * 0.6, -5.5)
    shelf.castShadow = true
    studio.add(shelf)

    // Libros en cada estante
    for (let j = 0; j < 8; j++) {
      const bookGeometry = new THREE.BoxGeometry(0.08, 0.25, 0.15)
      const bookMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.6, 0.4),
        roughness: 0.8
      })
      const book = new THREE.Mesh(bookGeometry, bookMaterial)
      book.position.set(
        3 - 1.4 + j * 0.35,
        0.63 + i * 0.6,
        -5.5 + (Math.random() - 0.5) * 0.1
      )
      book.rotation.y = (Math.random() - 0.5) * 0.2
      book.castShadow = true
      studio.add(book)
    }
  }

  // === PLANTAS ===
  const plantGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1, 8)
  const plantMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d5016,
    roughness: 0.9
  })

  const plant1 = new THREE.Mesh(plantGeometry, plantMaterial)
  plant1.position.set(-4, 0.5, -4)
  plant1.castShadow = true
  studio.add(plant1)

  const plant2 = plant1.clone()
  plant2.position.set(4.5, 0.5, -3)
  studio.add(plant2)

  // === ILUMINACIÓN CÁLIDA ===
  const warmLight = new THREE.PointLight(0xffa500, 1.5, 8)
  warmLight.position.set(-2, 3, -2)
  studio.add(warmLight)

  scene.add(studio)
  return studio
}

/**
 * Crea un escenario tech / keynote futurista
 */
export function createTechKeynoteStudio3D(scene) {
  const studio = new THREE.Group()
  studio.name = 'TechKeynoteStudio'

  // === SUELO REFLECTANTE NEGRO ===
  const floorGeometry = new THREE.PlaneGeometry(25, 25)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.1,
    metalness: 0.95,
    envMapIntensity: 2.0
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  studio.add(floor)

  // === GRID HOLOGRÁFICO EN EL SUELO ===
  const gridTexture = createGridTexture(0x00ffff)
  const gridMaterial = new THREE.MeshBasicMaterial({
    map: gridTexture,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  })
  const gridPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    gridMaterial
  )
  gridPlane.rotation.x = -Math.PI / 2
  gridPlane.position.y = 0.01
  studio.add(gridPlane)

  // === PANTALLA LED ULTRA-WIDE ===
  const screenGeometry = new THREE.BoxGeometry(12, 3, 0.1)
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x000033,
    emissive: 0x0066ff,
    emissiveIntensity: 1.2,
    roughness: 0.1,
    metalness: 0.95
  })
  const screen = new THREE.Mesh(screenGeometry, screenMaterial)
  screen.position.set(0, 2, -7)
  screen.castShadow = true
  studio.add(screen)

  // === PLATAFORMA ELEVADA ===
  const platformGeometry = new THREE.CylinderGeometry(3, 3, 0.2, 32)
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.2,
    metalness: 0.9
  })
  const platform = new THREE.Mesh(platformGeometry, platformMaterial)
  platform.position.set(0, 0.1, -2)
  platform.castShadow = true
  platform.receiveShadow = true
  studio.add(platform)

  // Borde LED de la plataforma
  const edgeGeometry = new THREE.TorusGeometry(3, 0.05, 16, 100)
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 2
  })
  const edge = new THREE.Mesh(edgeGeometry, edgeMaterial)
  edge.rotation.x = Math.PI / 2
  edge.position.set(0, 0.2, -2)
  studio.add(edge)

  // === COLUMNAS FUTURISTAS ===
  const columnGeometry = new THREE.CylinderGeometry(0.15, 0.15, 4, 8)
  const columnMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.2,
    metalness: 0.95,
    emissive: 0x0088ff,
    emissiveIntensity: 0.2
  })

  for (let i = 0; i < 6; i++) {
    const column = new THREE.Mesh(columnGeometry, columnMaterial)
    const angle = (i / 6) * Math.PI * 2
    const radius = 5
    column.position.set(
      Math.cos(angle) * radius,
      2,
      -2 + Math.sin(angle) * radius
    )
    column.castShadow = true
    studio.add(column)

    // Luz en cada columna
    const columnLight = new THREE.PointLight(0x0088ff, 1, 5)
    columnLight.position.copy(column.position)
    columnLight.position.y = 3.5
    studio.add(columnLight)
  }

  // === LUCES DE ACENTO AZULES ===
  const accentLight1 = new THREE.SpotLight(0x00ffff, 3, 15, Math.PI / 6, 0.5)
  accentLight1.position.set(-4, 5, -3)
  accentLight1.target.position.set(0, 0, -2)
  studio.add(accentLight1)
  studio.add(accentLight1.target)

  const accentLight2 = accentLight1.clone()
  accentLight2.position.set(4, 5, -3)
  studio.add(accentLight2)

  scene.add(studio)
  return studio
}

/**
 * Crea un escenario de concierto musical
 */
export function createConcertStudio3D(scene) {
  const studio = new THREE.Group()
  studio.name = 'ConcertStudio'

  // === SUELO DE ESCENARIO ===
  const floorGeometry = new THREE.PlaneGeometry(20, 20)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.8,
    metalness: 0.2
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  studio.add(floor)

  // === TRUSS STRUCTURE (estructura de luces) ===
  const trussGeometry = new THREE.BoxGeometry(0.2, 0.2, 10)
  const trussMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.5,
    metalness: 0.8
  })

  // Truss horizontal superior
  for (let i = 0; i < 3; i++) {
    const truss = new THREE.Mesh(trussGeometry, trussMaterial)
    truss.rotation.y = Math.PI / 2
    truss.position.set(0, 4 + i * 0.5, -3)
    truss.castShadow = true
    studio.add(truss)
  }

  // === MOVING HEAD LIGHTS (luces móviles) ===
  const lightGeometry = new THREE.ConeGeometry(0.2, 0.5, 8)
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.3,
    metalness: 0.9
  })

  const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff]

  for (let i = 0; i < 8; i++) {
    const light = new THREE.Mesh(lightGeometry, lightMaterial.clone())
    light.rotation.x = Math.PI
    light.position.set(-4 + i * 1.2, 4.5, -3)
    studio.add(light)

    // Spot light de cada moving head
    const spotLight = new THREE.SpotLight(
      colors[i % colors.length],
      2,
      12,
      Math.PI / 4,
      0.3
    )
    spotLight.position.copy(light.position)
    spotLight.target.position.set(
      light.position.x + (Math.random() - 0.5) * 2,
      0,
      -2 + (Math.random() - 0.5) * 2
    )
    spotLight.castShadow = true
    studio.add(spotLight)
    studio.add(spotLight.target)
  }

  // === LED PANELS (paneles LED de fondo) ===
  const panelGeometry = new THREE.BoxGeometry(1.5, 1.5, 0.1)

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: colors[(row + col) % colors.length],
        emissiveIntensity: 0.8 + Math.random() * 0.4
      })
      const panel = new THREE.Mesh(panelGeometry, panelMaterial)
      panel.position.set(
        -4.5 + col * 1.6,
        1 + row * 1.6,
        -6
      )
      studio.add(panel)
    }
  }

  // === HUMO/FOG (simulado con planos transparentes) ===
  const fogGeometry = new THREE.PlaneGeometry(15, 3)
  const fogMaterial = new THREE.MeshBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending
  })

  for (let i = 0; i < 3; i++) {
    const fog = new THREE.Mesh(fogGeometry, fogMaterial)
    fog.position.set(0, 1 + i * 0.8, -4 + i * 0.5)
    studio.add(fog)
  }

  scene.add(studio)
  return studio
}

/**
 * Crea una textura de grid procedural
 */
function createGridTexture(color = 0x3b82f6, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Fondo negro
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)

  // Grid
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`
  ctx.lineWidth = 2

  const gridSize = 32
  for (let i = 0; i <= size; i += gridSize) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, size)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(size, i)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)

  return texture
}
