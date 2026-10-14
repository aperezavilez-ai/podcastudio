export const MAX_CAMERA_SLOTS = 15
export const DEFAULT_CAMERA_SLOT_COUNT = 3
export const PRIMARY_CAMERA_SLOT = 1

export const CAM_SLOT_LABELS = [
  'CAM 1 · Izquierda',
  'CAM 2 · Master',
  'CAM 3 · Derecha',
  'CAM 4 · Aux 1',
  'CAM 5 · Aux 2',
  'CAM 6 · Aux 3',
  'CAM 7 · Mesa',
  'CAM 8 · Cenital',
  'CAM 9 · Móvil WiFi',
  'CAM 10 · Remota 1',
  'CAM 11 · Remota 2',
  'CAM 12 · Detalle 1',
  'CAM 13 · Detalle 2',
  'CAM 14 · Público',
  'CAM 15 · Extra',
]

export function getSlotLabel(index, customLabel, isMaster = false) {
  if (customLabel) return isMaster ? `${customLabel} ★` : customLabel
  const base = CAM_SLOT_LABELS[index] || `CAM ${index + 1}`
  return isMaster && !base.toLowerCase().includes('master') ? `${base} · Master` : base
}

export function pickPrimaryActiveSlot(streams, masterSlot = PRIMARY_CAMERA_SLOT) {
  if (streams?.[masterSlot]) return masterSlot
  const activeSlots = Object.keys(streams || {}).map(Number).filter((s) => streams[s]).sort((a, b) => a - b)
  return activeSlots[0] ?? masterSlot
}
