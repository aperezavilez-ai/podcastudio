const FULL_CAM = { top: 0, left: 0, width: 100, height: 100 }
const INSET_CAM = { top: 22, left: 10, width: 80, height: 74 }

export const BACKGROUND_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'noticias', label: '📺 Noticias' },
  { id: 'entrevistas', label: '🎙️ Entrevistas' },
  { id: 'musica', label: '🎸 Música' },
  { id: 'tech', label: '💻 Tech / Podcast' },
]

export const BACKGROUND_TEMPLATES = [
  { id: 'none', name: 'Sin fondo', category: 'all', desc: 'Cámara normal sin set virtual', chromaRecommended: false, camera: FULL_CAM },

  // TV & NOTICIAS
  { id: 'broadcast-news', name: 'Noticiero Central', category: 'noticias', desc: 'Set principal con videowall curvo y mesa informativa', chromaRecommended: true, camera: INSET_CAM },
  { id: 'breaking-news', name: 'Breaking News TV', category: 'noticias', desc: 'Edición urgente con franja roja e iluminación de alerta', chromaRecommended: true, camera: { top: 18, left: 8, width: 84, height: 76 } },
  { id: 'split-news', name: 'Mesa de Debate', category: 'noticias', desc: 'Panel informativo para debate con monitor lateral', chromaRecommended: true, camera: { top: 20, left: 4, width: 62, height: 75 } },
  { id: 'newsroom-prime', name: 'Newsroom Global', category: 'noticias', desc: 'Sala de redacción internacional con pantallas de noticias', chromaRecommended: true, camera: INSET_CAM },

  // ENTREVISTAS & TALK SHOW
  { id: 'late-night', name: 'Late Night Skyline', category: 'entrevistas', desc: 'Ventanal a rascacielos nocturnos, sillón de piel y lámpara vintage', chromaRecommended: true, camera: INSET_CAM },
  { id: 'warm-lounge', name: 'Lounge Madera Nórdica', category: 'entrevistas', desc: 'Pared de madera listonada, luces indirectas y ambiente cálido', chromaRecommended: true, camera: INSET_CAM },
  { id: 'corporate-blue', name: 'Oficina Ejecutiva', category: 'entrevistas', desc: 'Oficina ejecutiva con ventanal de luz diurna contemporánea', chromaRecommended: true, camera: INSET_CAM },

  // ESCENARIOS MUSICALES
  { id: 'music-acoustic', name: 'Live Acoustic Session', category: 'musica', desc: 'Fondo de ladrillo rústico con bombillas cálidas Edison', chromaRecommended: true, camera: INSET_CAM },
  { id: 'music-concert', name: 'Concierto Rock / Neón', category: 'musica', desc: 'Truss metálico de escenario con focos y reflectores de show', chromaRecommended: true, camera: INSET_CAM },
  { id: 'music-studio', name: 'Estudio Analógico', category: 'musica', desc: 'Sala insonorizada de grabación con difusores acústicos de madera', chromaRecommended: true, camera: INSET_CAM },

  // TECH & PODCAST
  { id: 'tech-studio', name: 'Creator Loft RGB', category: 'tech', desc: 'Paneles acústicos hexagonales y tubos LED RGB verticales', chromaRecommended: true, camera: INSET_CAM },
  { id: 'neon-night', name: 'Cyberpunk / AI Lab', category: 'tech', desc: 'Estudio futurista con hologramas y líneas neón cyan/magenta', chromaRecommended: true, camera: INSET_CAM },
  { id: 'podcast-dark', name: 'Podcast Oscuro', category: 'tech', desc: 'Fondo negro mate con acento ámbar/naranja broadcast', chromaRecommended: true, camera: INSET_CAM },
  { id: 'minimal-dark', name: 'Minimal Dark', category: 'tech', desc: 'Estudio minimalista gris oscuro limpio de alta gama', chromaRecommended: false, camera: INSET_CAM },
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
