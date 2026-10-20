export const BACKGROUND_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: '3d', label: '🎬 Escenarios 3D Profesionales' },
  { id: 'noticias', label: '📺 Noticias TV' },
  { id: 'entrevistas', label: '🎙️ Talk Show & Entrevistas' },
  { id: 'musica', label: '🎸 Escenarios Musicales' },
  { id: 'tech', label: '💻 Tech / Keynote' },
]

export const BACKGROUND_TEMPLATES = [
  {
    id: 'none',
    name: 'Sin fondo',
    category: 'all',
    desc: 'Cámara normal sin escenario virtual',
    chromaRecommended: false,
    image: null,
    video: null,
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
    liveVideo: false,
    is3D: false,
  },

  // ========================================
  // ESCENARIOS 3D PROFESIONALES (NEW)
  // ========================================
  {
    id: 'news-3d',
    name: '🎬 Estudio de Noticias 3D Profesional',
    category: '3d',
    desc: 'Set de noticiario broadcast completo con iluminación 3D real, sombras dinámicas y parallax reactivo',
    chromaRecommended: true,
    image: null,
    video: null,
    gltf: '/sets3d/news-modern.glb',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
    liveVideo: false,
    is3D: true,
    requiresWebGL: true,
  },
  {
    id: 'interview-3d',
    name: '🎬 Talk Show Cálido 3D',
    category: '3d',
    desc: 'Set de entrevista estilo late night con sofás 3D, biblioteca y plantas realistas con iluminación cálida',
    chromaRecommended: true,
    image: null,
    video: null,
    gltf: '/sets3d/talkshow-warm.glb',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
    liveVideo: false,
    is3D: true,
    requiresWebGL: true,
  },
  {
    id: 'tech-3d',
    name: '🎬 Tech Keynote 3D Futurista',
    category: '3d',
    desc: 'Escenario estilo Apple Keynote con pantalla LED ultra-wide, grid holográfico y materiales metálicos',
    chromaRecommended: true,
    image: null,
    video: null,
    gltf: '/sets3d/tech-keynote.glb',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
    liveVideo: false,
    is3D: true,
    requiresWebGL: true,
  },
  {
    id: 'concert-3d',
    name: '🎬 Escenario Musical 3D',
    category: '3d',
    desc: 'Stage de concierto con luces móviles animadas, humo volumétrico y efectos de escenario profesionales',
    chromaRecommended: true,
    image: null,
    video: null,
    gltf: '/sets3d/concert-stage.glb',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
    liveVideo: false,
    is3D: true,
    requiresWebGL: true,
  },

  // ========================================
  // ESCENARIOS 2D (LEGACY)
  // ========================================
  // 1. TV & NOTICIAS - 100% SET VIRTUAL
  {
    id: 'news-city-skyline',
    name: 'Noticias Blue Broadcast 3D (Set Vivo)',
    category: 'noticias',
    desc: 'Estudio de noticias broadcast 1080p con videowall animado, monitores de control y profundidad de campo 3D real',
    chromaRecommended: true,
    image: null,
    video: '/sets/news-city-skyline.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 56, scale: 92 },
    liveVideo: true,
  },

  // 2. ENTREVISTAS & TALK SHOW - 100% SET VIRTUAL
  {
    id: 'interview-studio-warm',
    name: 'Estudio Entrevistas Madera & Neón (Set Vivo)',
    category: 'entrevistas',
    desc: 'Set acústico moderno con listones de madera natural, iluminación LED cálida y ambiente íntimo de podcast profesional',
    chromaRecommended: true,
    image: null,
    video: '/sets/interview-studio-warm.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 55, scale: 90 },
    liveVideo: true,
  },

  // 3. TECH & KEYNOTE - 100% SET VIRTUAL
  {
    id: 'tech-keynote-modern',
    name: 'Tech Keynote Moderno (Set Vivo)',
    category: 'tech',
    desc: 'Escenario futurista con pantalla LED ultra panorámica y suelo reflectante de estudio',
    chromaRecommended: true,
    image: null,
    video: '/sets/tech-keynote-modern.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 62, scale: 80 },
    liveVideo: true,
  },

  // 4. MÚSICA & CONCIERTOS - 100% SET VIRTUAL
  {
    id: 'concert-stage-lights',
    name: 'Escenario Luces de Concierto (Set Vivo)',
    category: 'musica',
    desc: 'Plataforma musical con reflectores móviles y efectos visuales de escenario en vivo',
    chromaRecommended: true,
    image: null,
    video: '/sets/concert-stage-lights.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 68, scale: 85 },
    liveVideo: true,
    is3D: false,
  },
]

export function getBackgroundTemplate(id) {
  return BACKGROUND_TEMPLATES.find(t => t.id === id) || BACKGROUND_TEMPLATES[0]
}
