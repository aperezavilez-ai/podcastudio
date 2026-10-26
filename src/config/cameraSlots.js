export const MAX_CAMERA_SLOTS = 20
export const DEFAULT_CAMERA_SLOT_COUNT = 4
export const PRIMARY_CAMERA_SLOT = 0

export const CAM_SLOT_LABELS = Array.from({ length: MAX_CAMERA_SLOTS }, (_, i) => `CAM ${i + 1}`)

export const BROADCAST_LAYOUTS = [
  { id: '1', name: 'Plano Solo 1', icon: 'Square', description: 'Cámara seleccionada a pantalla completa', minCams: 1 },
  { id: 'pip', name: 'Modo PiP', icon: 'Layout', description: 'Master de fondo con recuadro flotante', minCams: 2 },
  { id: '2', name: 'Split 50/50', icon: 'Columns', description: '2 cámaras divididas verticalmente', minCams: 2 },
  { id: 'two-shot', name: 'Two-Shot', icon: 'Users', description: 'Plano doble de conversación con separación estética', minCams: 2 },
  { id: '3', name: '3 Cámaras', icon: 'LayoutGrid', description: '1 cámara principal y 2 auxiliares en mosaico', minCams: 3 },
  { id: '4', name: 'Cuadrícula 4', icon: 'Grid', description: '4 cámaras en matriz 2x2 balanceada', minCams: 4 },
  { id: '6', name: 'Cuadrícula 6', icon: 'Grid', description: '6 cámaras en matriz 3x2 equilibrada', minCams: 5 },
  { id: '6-lead', name: 'Líder + 5', icon: 'Layout', description: '1 conductor grande y 5 participantes debajo', minCams: 5 },
  { id: '8', name: 'Cuadrícula 8', icon: 'Grid', description: '8 cámaras en matriz 4x2 para paneles grandes', minCams: 7 },
  { id: '10', name: 'Cuadrícula 10', icon: 'Grid', description: '10 cámaras en matriz 5x2 broadcast completo', minCams: 9 },
  { id: 'gallery', name: 'Galería Auto', icon: 'Layers', description: 'Cuadrícula adaptativa que encuadra todas las cámaras activas', minCams: 2 },
  { id: 'speaker', name: 'Speaker View', icon: 'UserCheck', description: 'Orador activo en grande y tira de cámaras en miniatura', minCams: 2 },
]

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

