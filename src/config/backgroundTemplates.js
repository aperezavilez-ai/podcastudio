export const BACKGROUND_TEMPLATES = [
  { id: 'none', name: 'Sin fondo', category: 'Básico', desc: 'Cámara a pantalla completa', chromaRecommended: false, camera: { top: 0, left: 0, width: 100, height: 100 } },
]

export function getBackgroundTemplate(id) {
  return BACKGROUND_TEMPLATES.find(t => t.id === id) || BACKGROUND_TEMPLATES[0]
}
