import { PRIMARY_CAMERA_SLOT } from './cameraSlots.js'

/** CAM 1 = conductor · CAM 2 = master · CAM 3 = invitado */
export const HOST_CAMERA_SLOT = 0
export const MASTER_CAMERA_SLOT = PRIMARY_CAMERA_SLOT
export const GUEST_CAMERA_SLOT = 2

export const CINTILLO_SLOT_BY_PRESET = {
  host: HOST_CAMERA_SLOT,
  social: HOST_CAMERA_SLOT,
  contact: HOST_CAMERA_SLOT,
  guest: GUEST_CAMERA_SLOT,
  topic: MASTER_CAMERA_SLOT,
  promo: MASTER_CAMERA_SLOT,
  custom: MASTER_CAMERA_SLOT,
}

/** Rotación automática: master → invitado → conductor */
export const CINTILLO_ROTATION_ORDER = ['topic', 'guest', 'host', 'social', 'contact', 'promo']

export const DEFAULT_CINTILLO_POSITIONS = {
  host: 'bl',
  guest: 'br',
  master: 'bc',
}

export const CINTILLO_POSITION_OPTIONS = [
  { id: 'tl', icon: 'ti-arrow-up-left', label: 'Arriba izq.' },
  { id: 'tc', icon: 'ti-arrow-up', label: 'Arriba centro' },
  { id: 'tr', icon: 'ti-arrow-up-right', label: 'Arriba der.' },
  { id: 'ml', icon: 'ti-arrow-left', label: 'Centro izq.' },
  { id: 'mc', icon: 'ti-circle', label: 'Centro' },
  { id: 'mr', icon: 'ti-arrow-right', label: 'Centro der.' },
  { id: 'bl', icon: 'ti-arrow-down-left', label: 'Abajo izq.' },
  { id: 'bc', icon: 'ti-arrow-down', label: 'Abajo centro' },
  { id: 'br', icon: 'ti-arrow-down-right', label: 'Abajo der.' },
]

export const CINTILLO_CAMERA_GROUPS = [
  {
    role: 'host',
    slot: HOST_CAMERA_SLOT,
    label: 'CAM 1 · Conductor (izquierda)',
    defaultPosition: 'bl',
    presetIds: ['host', 'social', 'contact'],
  },
  {
    role: 'master',
    slot: MASTER_CAMERA_SLOT,
    label: 'CAM 2 · MASTER (centro)',
    defaultPosition: 'bc',
    presetIds: ['topic', 'promo'],
  },
  {
    role: 'guest',
    slot: GUEST_CAMERA_SLOT,
    label: 'CAM 3 · Invitado (derecha)',
    defaultPosition: 'br',
    presetIds: ['guest'],
  },
]

export function getPresetCameraSlot(presetId) {
  return CINTILLO_SLOT_BY_PRESET[presetId] ?? MASTER_CAMERA_SLOT
}

export function getRoleForSlot(slot) {
  if (slot === HOST_CAMERA_SLOT) return 'host'
  if (slot === GUEST_CAMERA_SLOT) return 'guest'
  return 'master'
}

export function getPositionForPreset(presetId, positions = DEFAULT_CINTILLO_POSITIONS) {
  const role = getRoleForSlot(getPresetCameraSlot(presetId))
  return positions[role] || DEFAULT_CINTILLO_POSITIONS[role] || 'bc'
}

export function loadCintilloPositions() {
  try {
    const raw = localStorage.getItem('podcastudio_cintillo_positions')
    if (!raw) return { ...DEFAULT_CINTILLO_POSITIONS }
    return { ...DEFAULT_CINTILLO_POSITIONS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CINTILLO_POSITIONS }
  }
}

export function saveCintilloPositions(positions) {
  localStorage.setItem('podcastudio_cintillo_positions', JSON.stringify(positions))
}
