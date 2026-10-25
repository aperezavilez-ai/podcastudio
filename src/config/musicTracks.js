// Pistas musicales libres de derechos de emisión (Broadcast Studio Standard)
export const MUSIC_GENRES = {
  rock: 'Rock Alternativo Enérgico',
  popelectro: 'Pop Electrónico Moderno',
  reggae: 'Reggae Relajado',
  lofi: 'Lo-Fi Chillhop',
  corporate: 'Corporate / Tech Inspiring',
  synthwave: 'Synthwave / Cyberpunk',
}

export const MUSIC_TRACKS = [
  // 1. Rock Alternativo Enérgico
  {
    id: 'rock-01',
    name: 'On Parole (High Energy)',
    sub: 'Rock Alternativo Enérgico · Riffs de guitarra eléctrica, batería contundente y bajo profundo',
    genre: 'rock',
    mood: 'energetic',
    url: '/music/rock-energetic.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/1188/1188.mp3',
  },
  {
    id: 'rock-02',
    name: 'Cat Walk (Alt Rock Beats)',
    sub: 'Rock Alternativo · Alta energía para transiciones dinámicas de cámara',
    genre: 'rock',
    mood: 'dynamic',
    url: '/music/rock-alt-motivation.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/519/519.mp3',
  },

  // 2. Pop Electrónico Moderno
  {
    id: 'popelectro-01',
    name: 'Pop Upbeat Delight',
    sub: 'Pop Electrónico Moderno · Sintetizadores brillantes, percusión digital y melodías pegadizas',
    genre: 'popelectro',
    mood: 'upbeat',
    url: '/music/pop-electronic.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/729/729.mp3',
  },

  // 3. Reggae Relajado
  {
    id: 'reggae-01',
    name: 'My Last Mojito',
    sub: 'Reggae Relajado · Ritmo tradicional, guitarra en contratiempo (skank) y bajo cálido',
    genre: 'reggae',
    mood: 'relaxed',
    url: '/music/reggae-relaxed.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/814/814.mp3',
  },
  {
    id: 'reggae-02',
    name: 'Jamaican Positive Flow',
    sub: 'Reggae Caribeño · Batería suave, percusión caribeña y ambiente fluido',
    genre: 'reggae',
    mood: 'positive',
    url: '/music/reggae-jamaican.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/241/241.mp3',
  },

  // 4. Lo-Fi Chillhop
  {
    id: 'lofi-01',
    name: 'Sleepy Cat Chillhop',
    sub: 'Lo-Fi Chillhop · Textura de vinilo, piano suave y bajos profundos para concentración',
    genre: 'lofi',
    mood: 'focus',
    url: '/music/lofi-chillhop.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/135/135.mp3',
  },
  {
    id: 'lofi-02',
    name: 'Sweet September',
    sub: 'Lo-Fi Chillhop · Beats relajados para escenas de diseño o codificación',
    genre: 'lofi',
    mood: 'calm',
    url: '/music/lofi-sweet-september.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/282/282.mp3',
  },

  // 5. Corporate / Tech Inspiring
  {
    id: 'corporate-01',
    name: 'Driving Ambition (Tech SaaS)',
    sub: 'Corporate Inspiring · Piano acústico limpio, cuerdas de fondo y percusión ascendente',
    genre: 'corporate',
    mood: 'inspiring',
    url: '/music/corporate-inspiring.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/32/32.mp3',
  },
  {
    id: 'corporate-02',
    name: 'Close Up Success Metrics',
    sub: 'Tech Corporate · Tono motivacional para métricas de éxito y lanzamientos',
    genre: 'corporate',
    mood: 'motivational',
    url: '/music/corporate-close-up.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/1167/1167.mp3',
  },

  // 6. Synthwave / Cyberpunk
  {
    id: 'synthwave-01',
    name: 'Sun in Your Eyes (Cyber Pulse)',
    sub: 'Synthwave / Cyberpunk · Electrónica retro-futurista, bajos arpegiados y cajas 80s',
    genre: 'synthwave',
    mood: 'cyberpunk',
    url: '/music/synthwave-cyberpunk.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/131/131.mp3',
  },
  {
    id: 'synthwave-02',
    name: 'Better Times (AI Tech Wave)',
    sub: 'Synthwave Futurista · Resalta características de inteligencia artificial y código avanzado',
    genre: 'synthwave',
    mood: 'futuristic',
    url: '/music/synthwave-better-times.mp3',
    fallbackUrl: 'https://assets.mixkit.co/music/173/173.mp3',
  },
]

/** URL de preview Mixkit verificada */
export function mixkitSfxUrl(id) {
  return `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`
}

/** Efectos de sonido profesionales de estudio y broadcast (Mixkit) */
export const SFX_CATEGORIES = {
  applause: 'Aplausos',
  ovation: 'Ovaciones',
  laughter: 'Carcajadas y Risas',
  doors: 'Puertas y Entornos',
  glass: 'Cristales y Choques',
  phone: 'Teléfonos y Ring Tones',
  comedy: 'Comedia y Bocinas',
  transition: 'Transiciones',
  impact: 'Impactos',
  intro: 'Intros',
  outro: 'Cierres',
  notification: 'Campanadas',
}

const SFX_RAW = [
  // Puertas y Entornos
  { id: 'sfx-door-01', name: 'Puerta abriéndose chirriante', sub: 'Suspenso / Entrada dramática', category: 'doors', mixkitId: 2573 },
  { id: 'sfx-door-02', name: 'Puerta abriéndose de golpe', sub: 'Llegada de invitado / Sorpresa', category: 'doors', mixkitId: 2574 },

  // Cristales y Choques
  { id: 'sfx-glass-01', name: 'Cristales quebrándose', sub: 'Impacto fuerte / Vidrio roto', category: 'glass', mixkitId: 2788 },
  { id: 'sfx-glass-02', name: 'Cristal rompiéndose en pedazos', sub: 'Error garrafal / Chocadero', category: 'glass', mixkitId: 2789 },

  // Carcajadas y Risas
  { id: 'sfx-laugh-02', name: 'Personas carcajeándose', sub: 'Momento muy cómico / Carcajadas', category: 'laughter', mixkitId: 460 },
  { id: 'sfx-laugh-01', name: 'Risa de público en estudio', sub: 'Chiste o momento cómico', category: 'laughter', mixkitId: 424 },
  { id: 'sfx-laugh-03', name: 'Carcajadas con aplausos', sub: 'Show de stand-up / comedia', category: 'laughter', mixkitId: 512 },
  { id: 'sfx-laugh-04', name: 'Risas de grupo en cabina', sub: 'Charla divertida entre amigos', category: 'laughter', mixkitId: 423 },

  // Teléfonos y Ring Tones
  { id: 'sfx-phone-01', name: 'Ring tone de llamada clásica', sub: 'Llamada telefónica entrante', category: 'phone', mixkitId: 1354 },
  { id: 'sfx-phone-02', name: 'Ring tone de oficina / cabina', sub: 'Timbre de teléfono en vivo', category: 'phone', mixkitId: 1356 },

  // Comedia y Bocinas
  { id: 'sfx-com-01', name: 'Bocina de aire / Corneta', sub: 'Celebración / Fiesta / Desmadre', category: 'comedy', mixkitId: 740 },
  { id: 'sfx-com-02', name: 'Grillos de silencio incómodo', sub: 'Chiste malo / Silencio total', category: 'comedy', mixkitId: 407 },

  // Aplausos reales
  { id: 'sfx-appl-01', name: 'Aplauso de estudio', sub: 'Público en vivo', category: 'applause', mixkitId: 528 },
  { id: 'sfx-appl-02', name: 'Ovación y palmas', sub: 'Entrada de invitado', category: 'applause', mixkitId: 529 },
  { id: 'sfx-appl-03', name: 'Aplauso entusiasta', sub: 'Audiencia contenta', category: 'applause', mixkitId: 485 },
  { id: 'sfx-appl-04', name: 'Palmas de grupo', sub: 'Mesa redonda', category: 'applause', mixkitId: 422 },
  { id: 'sfx-appl-05', name: 'Palmas rítmicas', sub: 'Energía alta', category: 'applause', mixkitId: 502 },

  // Ovaciones y vítores
  { id: 'sfx-ovat-01', name: 'Ovación fuerte', sub: 'Gran revelación', category: 'ovation', mixkitId: 476 },
  { id: 'sfx-ovat-02', name: 'Vítores y celebración', sub: 'Celebración en cabina', category: 'ovation', mixkitId: 462 },
  { id: 'sfx-ovat-03', name: 'Silbidos y aplausos', sub: 'Reconocimiento especial', category: 'ovation', mixkitId: 610 },
  { id: 'sfx-ovat-04', name: 'Euforia total', sub: 'Público masivo', category: 'ovation', mixkitId: 363 },

  // Transiciones de cabina
  { id: 'sfx-trans-01', name: 'Whoosh broadcast', sub: 'Cambio de tema / cámara', category: 'transition', mixkitId: 2568 },
  { id: 'sfx-trans-02', name: 'Swipe dinámico', sub: 'Corte rápido', category: 'transition', mixkitId: 2000 },

  // Impactos dramáticos
  { id: 'sfx-imp-01', name: 'Boom cinematográfico', sub: 'Momento clave / dato bomba', category: 'impact', mixkitId: 2083 },
  { id: 'sfx-imp-02', name: 'Golpe dramático', sub: 'Puntualización fuerte', category: 'impact', mixkitId: 1110 },

  // Intros y Outros
  { id: 'sfx-intro-01', name: 'Apertura de show', sub: 'Inicio de episodio', category: 'intro', mixkitId: 211 },
  { id: 'sfx-intro-02', name: 'Logo reveal', sub: 'Identidad sonora', category: 'intro', mixkitId: 2763 },
  { id: 'sfx-outro-01', name: 'Cierre con aplausos', sub: 'Despedida del programa', category: 'outro', mixkitId: 478 },
  { id: 'sfx-outro-02', name: 'Final enérgico', sub: 'Cierre triunfal', category: 'outro', mixkitId: 2003 },

  // Notificaciones y campanadas
  { id: 'sfx-notif-01', name: 'Campana positiva', sub: 'Dato correcto / punto ganado', category: 'notification', mixkitId: 2358 },
  { id: 'sfx-notif-02', name: 'Alerta sutil', sub: 'Llamada a la acción / aviso', category: 'notification', mixkitId: 2997 },
]

export const MUSIC_SFX = SFX_RAW.map((sfx) => ({
  ...sfx,
  url: mixkitSfxUrl(sfx.mixkitId),
}))

export function getTrackById(id) {
  return MUSIC_TRACKS.find(t => t.id === id) || null
}

export function getTracksByGenre(genre) {
  return MUSIC_TRACKS.filter(t => t.genre === genre)
}

export function resolveMusicTrack(trackId, genre) {
  if (trackId) {
    const t = getTrackById(trackId)
    if (t) return t
  }
  const byGenre = getTracksByGenre(genre || 'general')
  return byGenre[0] || MUSIC_TRACKS[0]
}
