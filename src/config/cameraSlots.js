export const MAX_CAMERA_SLOTS = 20
export const DEFAULT_CAMERA_SLOT_COUNT = 3
export const PRIMARY_CAMERA_SLOT = 0

export const CAM_SLOT_LABELS = Array.from({ length: MAX_CAMERA_SLOTS }, (_, i) => `CAM ${i + 1}`)

export function getSlotLabel(index, customLabel, isMaster = false) {
  let label = customLabel
  if (label && typeof label === 'string') {
    // Limpiar cualquier residuo de "Master" previo para que solo la cámara actualmente asignada lo tenga
    label = label.replace(/\s*[-·★]\s*Master/gi, '').trim()
  } else {
    label = `CAM ${index + 1}`
  }
  return isMaster ? `${label} ★ MASTER` : label
}

export function pickPrimaryActiveSlot(streams, masterSlot = PRIMARY_CAMERA_SLOT) {
  if (streams?.[masterSlot]) return masterSlot
  const activeSlots = Object.keys(streams || {}).map(Number).filter((s) => streams[s]).sort((a, b) => a - b)
  return activeSlots[0] ?? masterSlot
}

