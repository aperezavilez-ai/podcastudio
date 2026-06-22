import { CINTILLO_ROTATION_ORDER as CAMERA_ROTATION_ORDER } from './cintilloCameraMap.js'

export const CINTILLO_PRESETS = [
  { id: 'topic', label: 'Tema del episodio', tag: 'TEMA', color: '#4a90d9' },
  { id: 'host', label: 'Conductor / presentador', tag: 'HOST', color: '#e8612a' },
  { id: 'guest', label: 'Nombre invitado', tag: 'INVITADO', color: '#1D9E75' },
  { id: 'social', label: 'Redes sociales', tag: 'REDES', color: '#9d8ce8' },
  { id: 'contact', label: 'Contacto', tag: 'CONTACTO', color: '#febc2e' },
  { id: 'promo', label: 'Promoción', tag: 'PROMO', color: '#e8612a' },
]

/** Orden de rotación automática en el estudio (por cámara programada) */
export const CINTILLO_ROTATION_ORDER = CAMERA_ROTATION_ORDER

export const CINTILLO_SETUP_TYPES = [
  { id: 'topic', label: 'Tema del episodio', color: '#4a90d9' },
  { id: 'host', label: 'Conductor / presentador', color: '#e8612a' },
  { id: 'guest', label: 'Nombre del invitado', color: '#1D9E75' },
  { id: 'social', label: 'Redes sociales', color: '#9d8ce8' },
  { id: 'contact', label: 'Contacto (tel / producto)', color: '#febc2e' },
  { id: 'promo', label: 'Promoción', color: '#e8612a' },
]

export function resolveCintilloText(presetId, project) {
  const p = project || {}
  const c = p.cintillos || {}
  const slug = (p.name || 'mipodcast').toLowerCase().replace(/\s/g, '')

  const defaults = {
    topic: p.episodeTitle || 'Tema del episodio',
    host: p.hostName || p.name || 'Conductor',
    guest: [p.guestName, p.guestRole].filter(Boolean).join(' · ') || 'Invitado',
    social: `@${slug}`,
    contact: '',
    promo: 'Código: PODCAST24',
  }

  return (c[presetId] || defaults[presetId] || '').trim()
}

export function getRotationPresets(project) {
  const order = project?.cintilloRotation?.length
    ? project.cintilloRotation
    : CINTILLO_ROTATION_ORDER
  return order
    .map(id => CINTILLO_PRESETS.find(p => p.id === id))
    .filter(preset => {
      if (!preset) return false
      const text = resolveCintilloText(preset.id, project)
      return text.length > 0
    })
}
