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

/** Efectos musicales cortos — Mixkit (libre de derechos). */
export const SFX_CATEGORIES = {
  intro: 'Intros',
  transition: 'Transiciones',
  outro: 'Cierres',
  applause: 'Aplausos',
  impact: 'Impacto',
  notification: 'Notificaciones',
}

export const MUSIC_SFX = [
  { id: 'sfx-intro-01', name: 'Apertura épica', sub: 'Intro de episodio', category: 'intro', url: 'https://assets.mixkit.co/active_storage/sfx/211/211-preview.mp3' },
  { id: 'sfx-intro-02', name: 'Logo reveal', sub: 'Identidad de marca', category: 'intro', url: 'https://assets.mixkit.co/active_storage/sfx/2763/2763-preview.mp3' },
  { id: 'sfx-trans-01', name: 'Whoosh suave', sub: 'Cambio de sección', category: 'transition', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
  { id: 'sfx-trans-02', name: 'Swipe digital', sub: 'Transición moderna', category: 'transition', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
  { id: 'sfx-outro-01', name: 'Cierre cálido', sub: 'Despedida del episodio', category: 'outro', url: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3' },
  { id: 'sfx-outro-02', name: 'Fade out suave', sub: 'Final gradual', category: 'outro', url: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3' },
  { id: 'sfx-appl-01', name: 'Aplauso de estudio', sub: 'Cierre triunfal', category: 'applause', url: 'https://assets.mixkit.co/active_storage/sfx/528/528-preview.mp3' },
  { id: 'sfx-appl-02', name: 'Ovación corta', sub: 'Invitado especial', category: 'applause', url: 'https://assets.mixkit.co/active_storage/sfx/529/529-preview.mp3' },
  { id: 'sfx-imp-01', name: 'Golpe cinematográfico', sub: 'Momento clave', category: 'impact', url: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3' },
  { id: 'sfx-imp-02', name: 'Boom profundo', sub: 'Revelación', category: 'impact', url: 'https://assets.mixkit.co/active_storage/sfx/2083/2083-preview.mp3' },
  { id: 'sfx-notif-01', name: 'Campana positiva', sub: 'Dato importante', category: 'notification', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
  { id: 'sfx-notif-02', name: 'Alerta suave', sub: 'Llamada a la acción', category: 'notification', url: 'https://assets.mixkit.co/active_storage/sfx/2997/2997-preview.mp3' },
]

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
