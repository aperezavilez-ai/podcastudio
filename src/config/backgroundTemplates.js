export const BACKGROUND_CATEGORIES = [
  { id: 'all', label: 'Todos' },
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
    desk: null,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
  },

  // TV & NOTICIAS
  {
    id: 'news-prime',
    name: 'Noticiero Central 4K',
    category: 'noticias',
    desc: 'Set broadcast con ventanal panorámico a rascacielos y escritorio curvo con iluminación LED',
    chromaRecommended: true,
    image: '/sets/news-prime.jpg',
    desk: '/sets/news-prime-desk.png',
    hasDesk: true,
    defaultPresenter: { x: 50, y: 56, scale: 92 },
  },
  {
    id: 'news-3d-modern',
    name: 'Estudio 3D Circular Noticias',
    category: 'noticias',
    desc: 'Plataforma circular con pantallas informativas de control y horizonte nocturno',
    chromaRecommended: true,
    image: '/sets/news-3d-modern.jpg',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 54, scale: 88 },
  },

  // ENTREVISTAS & TALK SHOW
  {
    id: 'talkshow-late',
    name: 'Late Night Talk Show',
    category: 'entrevistas',
    desc: 'Loft estilo Nueva York con ladrillo visto rústico, focos de cine vintage y escritorio de madera',
    chromaRecommended: true,
    image: '/sets/talkshow-late.jpg',
    desk: '/sets/talkshow-late-desk.png',
    hasDesk: true,
    defaultPresenter: { x: 50, y: 55, scale: 90 },
  },

  // TECH & KEYNOTE
  {
    id: 'corporate-stage',
    name: 'Gran Escenario Keynote 3D',
    category: 'tech',
    desc: 'Auditorio con pantalla LED gigante curva de alta resolución y tarima circular brillante',
    chromaRecommended: true,
    image: '/sets/corporate-stage.jpg',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 62, scale: 80 },
  },
  {
    id: 'tech-cyber',
    name: 'Cyber Tech & Podcast IA',
    category: 'tech',
    desc: 'Estudio futurista con paneles acústicos negros, barras neón RGB verticales y mesa de podcast',
    chromaRecommended: true,
    image: '/sets/tech-cyber.jpg',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 58, scale: 92 },
  },

  // MÚSICA & CONCIERTOS
  {
    id: 'concert-arena',
    name: 'Arena Concierto / Live Session',
    category: 'musica',
    desc: 'Escenario de concierto profesional con truss metálico, luces robóticas y tarima de directo',
    chromaRecommended: true,
    image: '/sets/concert-arena.jpg',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 68, scale: 85 },
  },
  {
    id: 'arena-truss-360',
    name: 'Arena 360 Truss Circular',
    category: 'musica',
    desc: 'Set envolvente 360 grados con estructura metálica de focos cenitales',
    chromaRecommended: true,
    image: '/sets/arena-truss-360.jpg',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 60, scale: 85 },
  },
]

export function getBackgroundTemplate(id) {
  return BACKGROUND_TEMPLATES.find(t => t.id === id) || BACKGROUND_TEMPLATES[0]
}
