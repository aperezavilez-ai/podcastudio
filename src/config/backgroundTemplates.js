export const BACKGROUND_TEMPLATES = [
  { id: 'none', name: 'Sin fondo', category: 'Básico', desc: 'Solo cámara a pantalla completa', chromaRecommended: false, camera: { top: 0, left: 0, width: 100, height: 100 } },
  { id: 'broadcast-news', name: 'Broadcast News', category: 'TV', desc: 'Noticiero profesional rojo y gris', chromaRecommended: true, camera: { top: 8, left: 12, width: 76, height: 82 } },
  { id: 'breaking-news', name: 'Breaking News', category: 'TV', desc: 'Urgente · breaking live', chromaRecommended: true, camera: { top: 10, left: 8, width: 84, height: 78 } },
  { id: 'tech-studio', name: 'Tech Studio', category: 'Tech', desc: 'Amarillo industrial moderno', chromaRecommended: true, camera: { top: 6, left: 10, width: 80, height: 84 } },
  { id: 'glam-tv', name: 'Glam TV', category: 'Entretenimiento', desc: 'Rosa elegante con luces', chromaRecommended: true, camera: { top: 12, left: 15, width: 70, height: 75 } },
  { id: 'sport-energy', name: 'Sport Club', category: 'Deportes', desc: 'Azul dinámico deportivo', chromaRecommended: true, camera: { top: 8, left: 10, width: 80, height: 80 } },
  { id: 'podcast-dark', name: 'Podcast Pro', category: 'Podcast', desc: 'Estudio oscuro con luces cálidas', chromaRecommended: false, camera: { top: 15, left: 20, width: 60, height: 68 } },
  { id: 'kids-color', name: 'Kids Show', category: 'Infantil', desc: 'Colorido y divertido', chromaRecommended: true, camera: { top: 10, left: 12, width: 76, height: 78 } },
  { id: 'corporate-blue', name: 'Corporate', category: 'Negocios', desc: 'Azul corporativo limpio', chromaRecommended: false, camera: { top: 12, left: 18, width: 64, height: 72 } },
  { id: 'neon-night', name: 'Neon Night', category: 'Entretenimiento', desc: 'Neón púrpura nocturno', chromaRecommended: true, camera: { top: 8, left: 10, width: 80, height: 82 } },
  { id: 'warm-lounge', name: 'Warm Lounge', category: 'Podcast', desc: 'Sala cálida acogedora', chromaRecommended: false, camera: { top: 14, left: 16, width: 68, height: 70 } },
  { id: 'split-news', name: 'Split Screen', category: 'TV', desc: 'Doble ventana noticiero', chromaRecommended: true, camera: { top: 18, left: 6, width: 42, height: 62 } },
  { id: 'minimal-dark', name: 'Minimal Dark', category: 'Básico', desc: 'Gradiente oscuro minimalista', chromaRecommended: false, camera: { top: 5, left: 8, width: 84, height: 88 } },
]

export function getBackgroundTemplate(id) {
  return BACKGROUND_TEMPLATES.find(t => t.id === id) || BACKGROUND_TEMPLATES[0]
}
