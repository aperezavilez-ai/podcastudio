// Pistas libres de derechos (SoundHelix — uso permitido con atribución)
export const MUSIC_GENRES = {
  tech: 'Tecnología',
  business: 'Negocios',
  interview: 'Entrevista',
  comedy: 'Comedia',
  news: 'Noticias',
  wellness: 'Bienestar',
  sports: 'Deportes',
  culture: 'Cultura',
  education: 'Educación',
  marketing: 'Marketing',
  crime: 'True crime',
  general: 'General',
}

export const MUSIC_TRACKS = [
  { id: 'tech-01', name: 'Digital Pulse', sub: 'Electrónica suave', genre: 'tech', mood: 'focus', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'tech-02', name: 'Future Lab', sub: 'Innovación', genre: 'tech', mood: 'modern', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 'business-01', name: 'Boardroom', sub: 'Corporativo', genre: 'business', mood: 'professional', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'business-02', name: 'Growth Path', sub: 'Emprendimiento', genre: 'business', mood: 'uplifting', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: 'interview-01', name: 'Soft Talk', sub: 'Conversación', genre: 'interview', mood: 'calm', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'interview-02', name: 'Studio Lounge', sub: 'Ambiente cálido', genre: 'interview', mood: 'warm', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: 'comedy-01', name: 'Light Bounce', sub: 'Divertido', genre: 'comedy', mood: 'playful', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 'news-01', name: 'Breaking Desk', sub: 'Noticiero', genre: 'news', mood: 'urgent', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'wellness-01', name: 'Calm Breath', sub: 'Meditación', genre: 'wellness', mood: 'peaceful', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: 'sports-01', name: 'Game On', sub: 'Energía alta', genre: 'sports', mood: 'energetic', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: 'culture-01', name: 'Acoustic Tales', sub: 'Cultural', genre: 'culture', mood: 'organic', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { id: 'education-01', name: 'Learn Forward', sub: 'Inspirador', genre: 'education', mood: 'hopeful', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
  { id: 'marketing-01', name: 'Brand Wave', sub: 'Moderno', genre: 'marketing', mood: 'catchy', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
  { id: 'crime-01', name: 'Dark Case', sub: 'Suspenso', genre: 'crime', mood: 'mystery', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' },
  { id: 'general-01', name: 'Neutral Bed', sub: 'Fondo universal', genre: 'general', mood: 'neutral', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
  { id: 'general-02', name: 'Open Studio', sub: 'Ambiente abierto', genre: 'general', mood: 'light', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' },
]

/** URL de preview Mixkit (verificada). */
export function mixkitSfxUrl(id) {
  return `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`
}

/** Efectos musicales cortos — Mixkit (libre de derechos). */
export const SFX_CATEGORIES = {
  intro: 'Intros',
  transition: 'Transiciones',
  outro: 'Cierres',
  applause: 'Aplausos',
  laughter: 'Risas',
  ovation: 'Ovaciones',
  crowd: 'Público',
  impact: 'Impactos y choques',
  car: 'Autos y tráfico',
  notification: 'Notificaciones',
}

const SFX_RAW = [
  { id: 'sfx-intro-01', name: 'Apertura épica', sub: 'Inicio de episodio', category: 'intro', mixkitId: 211 },
  { id: 'sfx-intro-02', name: 'Logo reveal', sub: 'Identidad de marca', category: 'intro', mixkitId: 2763 },
  { id: 'sfx-trans-01', name: 'Whoosh suave', sub: 'Cambio de sección', category: 'transition', mixkitId: 2568 },
  { id: 'sfx-trans-02', name: 'Swipe digital', sub: 'Transición moderna', category: 'transition', mixkitId: 2000 },
  { id: 'sfx-outro-01', name: 'Cierre con aplausos', sub: 'Final de show', category: 'outro', mixkitId: 478 },
  { id: 'sfx-outro-02', name: 'Despedida energética', sub: 'Cierre de episodio', category: 'outro', mixkitId: 2003 },
  { id: 'sfx-appl-01', name: 'Aplauso de estudio', sub: 'Cierre triunfal', category: 'applause', mixkitId: 528 },
  { id: 'sfx-appl-02', name: 'Ovación corta', sub: 'Invitado especial', category: 'applause', mixkitId: 529 },
  { id: 'sfx-appl-03', name: 'Aplauso mediano', sub: 'Público contento', category: 'applause', mixkitId: 485 },
  { id: 'sfx-appl-04', name: 'Palmas de grupo', sub: 'Audiencia pequeña', category: 'applause', mixkitId: 422 },
  { id: 'sfx-appl-05', name: 'Aplauso ligero', sub: 'Teatro', category: 'applause', mixkitId: 518 },
  { id: 'sfx-appl-06', name: 'Palmas rítmicas', sub: 'Energía alta', category: 'applause', mixkitId: 502 },
  { id: 'sfx-laugh-01', name: 'Risa de público', sub: 'Corto y natural', category: 'laughter', mixkitId: 424 },
  { id: 'sfx-laugh-02', name: 'Risas de adolescentes', sub: 'Ambiente juvenil', category: 'laughter', mixkitId: 429 },
  { id: 'sfx-laugh-03', name: 'Gran carcajada', sub: 'Público numeroso', category: 'laughter', mixkitId: 460 },
  { id: 'sfx-laugh-04', name: 'Risas de grupo', sub: 'Varios hombres', category: 'laughter', mixkitId: 423 },
  { id: 'sfx-laugh-05', name: 'Feria con risas', sub: 'Ambiente alegre', category: 'laughter', mixkitId: 368 },
  { id: 'sfx-laugh-06', name: 'Risa con aplausos', sub: 'Show de comedia', category: 'laughter', mixkitId: 512 },
  { id: 'sfx-ovat-01', name: 'Ovación fuerte', sub: 'Conferencia', category: 'ovation', mixkitId: 476 },
  { id: 'sfx-ovat-02', name: 'Victoria con gritos', sub: 'Estadio', category: 'ovation', mixkitId: 462 },
  { id: 'sfx-ovat-03', name: 'Silbido y ovación', sub: 'Celebración', category: 'ovation', mixkitId: 610 },
  { id: 'sfx-ovat-04', name: 'Estadio eufórico', sub: 'Aplausos y tambores', category: 'ovation', mixkitId: 363 },
  { id: 'sfx-crowd-01', name: 'Público celebrando', sub: 'Gritos de alegría', category: 'crowd', mixkitId: 3035 },
  { id: 'sfx-crowd-02', name: 'Multitud animada', sub: 'Ambiente vivo', category: 'crowd', mixkitId: 523 },
  { id: 'sfx-imp-01', name: 'Golpe cinematográfico', sub: 'Momento clave', category: 'impact', mixkitId: 1110 },
  { id: 'sfx-imp-02', name: 'Boom profundo', sub: 'Revelación', category: 'impact', mixkitId: 2083 },
  { id: 'sfx-imp-03', name: 'Explosión metálica', sub: 'Choque dramático', category: 'impact', mixkitId: 1687 },
  { id: 'sfx-imp-04', name: 'Choque con explosión', sub: 'Camión', category: 'impact', mixkitId: 1616 },
  { id: 'sfx-imp-05', name: 'Estructura colapsando', sub: 'Impacto fuerte', category: 'impact', mixkitId: 389 },
  { id: 'sfx-imp-06', name: 'Explosión lejana', sub: 'Boom', category: 'impact', mixkitId: 2958 },
  { id: 'sfx-car-01', name: 'Arranque de motor', sub: 'Encendido', category: 'car', mixkitId: 1561 },
  { id: 'sfx-car-02', name: 'Claxon clásico', sub: 'Bocina', category: 'car', mixkitId: 1565 },
  { id: 'sfx-car-03', name: 'Auto a toda velocidad', sub: 'Pasa rápido', category: 'car', mixkitId: 1538 },
  { id: 'sfx-car-04', name: 'Tráfico urbano', sub: 'Ciudad', category: 'car', mixkitId: 1554 },
  { id: 'sfx-car-05', name: 'Explosión de auto', sub: 'Accidente', category: 'car', mixkitId: 1562 },
  { id: 'sfx-car-06', name: 'Puerta de auto', sub: 'Portazo', category: 'car', mixkitId: 718 },
  { id: 'sfx-car-07', name: 'Choque corto', sub: 'Golpe de auto', category: 'car', mixkitId: 1555 },
  { id: 'sfx-notif-01', name: 'Campana positiva', sub: 'Dato importante', category: 'notification', mixkitId: 2358 },
  { id: 'sfx-notif-02', name: 'Alerta suave', sub: 'Llamada a la acción', category: 'notification', mixkitId: 2997 },
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
