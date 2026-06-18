export const TOUR_STEPS = [
  {
    id: 'cameras',
    icon: 'ti-video',
    title: 'Switcher de cámaras',
    description: 'Conecta cámaras USB, WiFi o Bluetooth y cambia entre planos en vivo con un clic. Ideal para entrevistas y podcasts multipersona.',
    demoHint: 'Las miniaturas parpadean al simular un cambio de cámara.',
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
    id: 'live',
    icon: 'ti-broadcast',
    title: 'Transmisión en vivo',
    description: 'Emite a YouTube, Facebook, TikTok e Instagram con stream keys RTMP. Mira espectadores simulados por plataforma.',
    demoHint: 'Los indicadores EN VIVO no transmiten en este recorrido.',
    plans: [
      { id: 'starter', label: '1 plataforma', highlight: false },
      { id: 'pro', label: '4 plataformas', highlight: true },
      { id: 'annual', label: '4 plataformas', highlight: true },
    ],
  },
  {
    id: 'posts',
    icon: 'ti-sparkles',
    title: 'Posts virales con IA',
    description: 'Tras grabar, genera publicaciones y hashtags optimizados para cada red con un clic. Copia y pega en tus canales.',
    demoHint: 'Los textos mostrados son ejemplos generados para la demo.',
    plans: [
      { id: 'starter', label: '20 posts / mes', highlight: false },
      { id: 'pro', label: 'Ilimitados', highlight: true },
      { id: 'annual', label: 'Ilimitados', highlight: true },
    ],
  },
  {
    id: 'export',
    icon: 'ti-download',
    title: 'Grabación y exportación',
    description: 'Graba el episodio en el navegador y descarga en WebM o MP4. Música sin copyright de fondo y calidad HD de cámara.',
    demoHint: 'No se graba ni descarga ningún archivo en el recorrido.',
    plans: [
      { id: 'starter', label: 'HD 1080p', highlight: false },
      { id: 'pro', label: '4K + música', highlight: true },
      { id: 'annual', label: '4K + música', highlight: true },
    ],
  },
]

export function markTourSeen() {
  localStorage.setItem('podcastudio_tour_seen', '1')
}

export function hasSeenTour() {
  return localStorage.getItem('podcastudio_tour_seen') === '1'
}
