export const TOUR_STEPS = [
  {
    id: 'cameras',
    icon: 'ti-video',
    title: 'Switcher de cámaras',
    description: 'Conecta cámaras USB, WiFi o Bluetooth y cambia entre planos con un clic. Ideal para entrevistas y podcasts multipersona.',
    demoHint: 'Las miniaturas muestran planos reales de estudio; al usar la app verás tu cámara.',
    plans: [
      { id: 'starter', label: '2 cámaras', highlight: false },
      { id: 'pro', label: '3 cámaras', highlight: true },
      { id: 'annual', label: '3 cámaras', highlight: false },
    ],
  },
  {
    id: 'director',
    icon: 'ti-wand',
    title: 'Director IA',
    description: 'La IA detecta quién habla y cambia automáticamente el plano, el encuadre y el tiempo en pantalla. Tú te concentras en conducir.',
    demoHint: 'El badge morado indica que el Director IA eligió la cámara activa.',
    plans: [
      { id: 'starter', label: 'No incluido', highlight: false, muted: true },
      { id: 'pro', label: 'Incluido', highlight: true },
      { id: 'annual', label: 'Incluido', highlight: true },
    ],
  },
  {
    id: 'cintillos',
    icon: 'ti-layout-bottombar',
    title: 'Cintillos y teleprompter',
    description: 'Cintillos animados para invitado, tema y redes. Teleprompter con scroll, pausa con Espacio y carga de guion desde Word.',
    demoHint: 'El cintillo inferior y el teleprompter son solo vista previa.',
    plans: [
      { id: 'starter', label: 'Cintillos básicos', highlight: false },
      { id: 'pro', label: 'Ilimitados + IA', highlight: true },
      { id: 'annual', label: 'Ilimitados + IA', highlight: true },
    ],
  },
  {
    id: 'export',
    icon: 'ti-download',
    title: 'Graba y descarga',
    description: 'Graba el episodio en el navegador con cintillos, logo y música. Descarga en WebM o MP4 y súbelo a YouTube, TikTok, Instagram o Facebook.',
    demoHint: 'No se graba ni descarga ningún archivo en el recorrido.',
    plans: [
      { id: 'starter', label: 'HD 1080p', highlight: false },
      { id: 'pro', label: 'HD + música', highlight: true },
      { id: 'annual', label: 'HD + música', highlight: true },
    ],
  },
  {
    id: 'look',
    icon: 'ti-palette',
    title: 'Look Pro',
    description: 'Presets de color, viñeta cinematográfica, LUTs y transiciones suaves entre cámaras. Todo se quema en la grabación.',
    demoHint: 'Los ajustes de imagen se aplican en el compositor del estudio.',
    plans: [
      { id: 'starter', label: '3 presets', highlight: false },
      { id: 'pro', label: 'Look + LUTs', highlight: true },
      { id: 'annual', label: 'Look + LUTs', highlight: true },
    ],
  },
  {
    id: 'posts',
    icon: 'ti-sparkles',
    title: 'Posts virales con IA',
    description: 'Tras grabar, genera publicaciones y hashtags optimizados para cada red con un clic. Copia el texto y sube tu video a tus canales.',
    demoHint: 'Los textos mostrados son ejemplos generados para la demo.',
    plans: [
      { id: 'starter', label: '20 posts / mes', highlight: false },
      { id: 'pro', label: 'Ilimitados', highlight: true },
      { id: 'annual', label: 'Ilimitados', highlight: true },
    ],
  },
]

export function markTourSeen() {
  localStorage.setItem('podcastudio_tour_seen', '1')
}

export function hasSeenTour() {
  return localStorage.getItem('podcastudio_tour_seen') === '1'
}
