const FULL_CAM = { top: 0, left: 0, width: 100, height: 100 }
const INSET_CAM = { top: 52, left: 10, width: 80, height: 44 }

export const BACKGROUND_TEMPLATES = [
  { id: 'none', name: 'Sin fondo', category: 'Básico', desc: 'Cámara a pantalla completa', chromaRecommended: false, camera: FULL_CAM },
  { id: 'broadcast-news', name: 'Noticias', category: 'TV', desc: 'Set rojo estilo noticiero', chromaRecommended: true, camera: INSET_CAM },
  { id: 'breaking-news', name: 'Breaking', category: 'TV', desc: 'Urgente con franja roja', chromaRecommended: true, camera: { top: 48, left: 8, width: 84, height: 46 } },
  { id: 'tech-studio', name: 'Tech', category: 'Estudio', desc: 'Azul corporativo tech', chromaRecommended: false, camera: INSET_CAM },
  { id: 'glam-tv', name: 'Glamour', category: 'Entretenimiento', desc: 'Morado con luces', chromaRecommended: false, camera: { top: 50, left: 12, width: 76, height: 46 } },
  { id: 'sport-energy', name: 'Deportes', category: 'Deportes', desc: 'Verde dinámico', chromaRecommended: true, camera: INSET_CAM },
  { id: 'podcast-dark', name: 'Podcast oscuro', category: 'Podcast', desc: 'Fondo oscuro con acento naranja', chromaRecommended: false, camera: { top: 54, left: 8, width: 84, height: 42 } },
  { id: 'kids-color', name: 'Infantil', category: 'Entretenimiento', desc: 'Colores alegres', chromaRecommended: false, camera: { top: 56, left: 14, width: 72, height: 40 } },
  { id: 'corporate-blue', name: 'Corporativo', category: 'Negocios', desc: 'Azul ejecutivo', chromaRecommended: false, camera: INSET_CAM },
  { id: 'neon-night', name: 'Neón', category: 'Creativo', desc: 'Oscuro con neón', chromaRecommended: false, camera: { top: 50, left: 10, width: 80, height: 46 } },
  { id: 'warm-lounge', name: 'Sala cálida', category: 'Entrevista', desc: 'Ambiente lounge', chromaRecommended: false, camera: INSET_CAM },
  { id: 'split-news', name: 'Split noticias', category: 'TV', desc: 'Panel lateral', chromaRecommended: true, camera: { top: 52, left: 4, width: 58, height: 44 } },
  { id: 'minimal-dark', name: 'Minimal', category: 'Básico', desc: 'Gris oscuro limpio', chromaRecommended: false, camera: INSET_CAM },
]

export function getBackgroundTemplate(id) {
  return BACKGROUND_TEMPLATES.find(t => t.id === id) || BACKGROUND_TEMPLATES[0]
}

export function getBackgroundCameraRect(templateId, scalePct = 100) {
  const t = getBackgroundTemplate(templateId)
  const cam = t.camera || FULL_CAM
  const scale = Math.max(70, Math.min(130, scalePct)) / 100
  const w = Math.min(100, cam.width * scale)
  const h = Math.min(100, cam.height * scale)
  const left = cam.left + (cam.width - w) / 2
  const top = cam.top + (cam.height - h) / 2
  return { top, left, width: w, height: h }
}
