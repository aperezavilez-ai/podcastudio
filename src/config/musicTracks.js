// Pistas musicales libres de derechos de emisión (Kevin MacLeod / Incompetech — Broadcast Studio Standard)
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
  { id: 'interview-01', name: 'Lobby Time', sub: 'Lofi Chillhop / Entrevista', genre: 'interview', mood: 'warm', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lobby%20Time.mp3' },
  { id: 'tech-01', name: 'Deliberate Thought', sub: 'Tech Modern / Innovación', genre: 'tech', mood: 'focus', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deliberate%20Thought.mp3' },
  { id: 'general-01', name: 'Chill Wave', sub: 'Groove Suave / Fondo Estudio', genre: 'general', mood: 'calm', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Chill.mp3' },
  { id: 'business-01', name: 'Local Forecast', sub: 'Bossa & Lounge Corporativo', genre: 'business', mood: 'professional', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Local%20Forecast%20-%20Elevator.mp3' },
  { id: 'comedy-01', name: 'Carefree', sub: 'Alegre / Dinámico', genre: 'comedy', mood: 'playful', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3' },
  { id: 'comedy-02', name: 'Sneaky Snitch', sub: 'Comedia Clásica / Bromas', genre: 'comedy', mood: 'funny', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3' },
  { id: 'interview-02', name: 'Airport Lounge', sub: 'Lounge Sofisticado / Charla', genre: 'interview', mood: 'sophisticated', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Airport%20Lounge.mp3' },
  { id: 'marketing-01', name: 'Groove Grove', sub: 'Funk & Beat Moderno', genre: 'marketing', mood: 'catchy', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Groove%20Grove.mp3' },
  { id: 'news-01', name: 'Daily Beetle', sub: 'Noticiero Matutino', genre: 'news', mood: 'urgent', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Daily%20Beetle.mp3' },
  { id: 'culture-01', name: 'Modern Jazz Samba', sub: 'Jazz Latino Acústico', genre: 'culture', mood: 'organic', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Modern%20Jazz%20Samba.mp3' },
  { id: 'wellness-01', name: 'Cool Vibes', sub: 'Deep Jazz / Nocturno', genre: 'wellness', mood: 'peaceful', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Vibes.mp3' },
  { id: 'culture-02', name: 'Bossa Antigua', sub: 'Bossa Nova Acústica', genre: 'culture', mood: 'warm', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bossa%20Antigua.mp3' },
  { id: 'crime-01', name: 'Covert Affair', sub: 'Misterio & Suspenso', genre: 'crime', mood: 'mystery', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Covert%20Affair.mp3' },
  { id: 'education-01', name: 'Mining by Moonlight', sub: 'Reflexivo & Crecimiento', genre: 'education', mood: 'hopeful', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Mining%20by%20Moonlight.mp3' },
]

/** URL de preview Mixkit verificada */
export function mixkitSfxUrl(id) {
  return `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`
}

/** Efectos de sonido profesionales de estudio y broadcast (Mixkit) */
export const SFX_CATEGORIES = {
  applause: 'Aplausos',
  ovation: 'Ovaciones',
  laughter: 'Risas',
  transition: 'Transiciones',
  impact: 'Impactos',
  intro: 'Intros',
  outro: 'Cierres',
  notification: 'Campanadas',
}

const SFX_RAW = [
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

  // Risas naturales de estudio
  { id: 'sfx-laugh-01', name: 'Risa de público', sub: 'Chiste o momento cómico', category: 'laughter', mixkitId: 424 },
  { id: 'sfx-laugh-02', name: 'Gran carcajada', sub: 'Momento muy divertido', category: 'laughter', mixkitId: 460 },
  { id: 'sfx-laugh-03', name: 'Risa con aplausos', sub: 'Show de stand-up / comedia', category: 'laughter', mixkitId: 512 },
  { id: 'sfx-laugh-04', name: 'Risas de grupo', sub: 'Charla divertida', category: 'laughter', mixkitId: 423 },

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
