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
    video: null,
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 50, scale: 100 },
  },

  // TV & NOTICIAS
  {
    id: 'news-prime',
    name: 'Noticiero Central 4K (Set Vivo)',
    category: 'noticias',
    desc: 'Estudio broadcast con videowall animado, horizonte urbano y escritorio curvo con iluminación LED',
    chromaRecommended: true,
    image: '/sets/news-prime.jpg',
    video: '/sets/news-prime.mp4',
    desk: '/sets/news-prime-desk.png',
    hasDesk: true,
    defaultPresenter: { x: 50, y: 56, scale: 92 },
  },

  // ENTREVISTAS & TALK SHOW
  {
    id: 'talkshow-late',
    name: 'Late Night Talk Show (Set Vivo)',
    category: 'entrevistas',
    desc: 'Loft estilo Nueva York con ladrillo visto, focos de cine vintage y escritorio de madera noble',
    chromaRecommended: true,
    image: '/sets/talkshow-late.jpg',
    video: '/sets/talkshow-late.mp4',
    desk: '/sets/talkshow-late-desk.png',
    hasDesk: true,
    defaultPresenter: { x: 50, y: 55, scale: 90 },
  },

  // TECH & KEYNOTE
  {
    id: 'corporate-stage',
    name: 'Gran Escenario Keynote 3D (Set Vivo)',
    category: 'tech',
    desc: 'Auditorio con pantalla LED gigante curva animada y tarima circular brillante',
    chromaRecommended: true,
    image: '/sets/corporate-stage.jpg',
    video: '/sets/corporate-stage.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 62, scale: 80 },
  },
  {
    id: 'tech-cyber',
    name: 'Cyber Tech & Podcast IA (Set Vivo)',
    category: 'tech',
    desc: 'Estudio futurista con paneles acústicos negros, barras neón RGB pulsantes y mesa de podcast',
    chromaRecommended: true,
    image: '/sets/tech-cyber.jpg',
    video: '/sets/tech-cyber.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 58, scale: 92 },
  },

  // MÚSICA & CONCIERTOS
  {
    id: 'concert-arena',
    name: 'Arena Concierto / Live Session (Set Vivo)',
    category: 'musica',
    desc: 'Escenario de concierto profesional con truss metálico, luces robóticas móviles y tarima de directo',
    chromaRecommended: true,
    image: '/sets/concert-arena.jpg',
    video: '/sets/concert-arena.mp4',
    desk: null,
    hasDesk: false,
    defaultPresenter: { x: 50, y: 68, scale: 85 },
  },
]

export function getBackgroundTemplate(id) {
  return BACKGROUND_TEMPLATES.find(t => t.id === id) || BACKGROUND_TEMPLATES[0]
}
