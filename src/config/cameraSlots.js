/** CAM 1 = izquierda (0), CAM 2 = centro / principal (1), CAM 3 = derecha (2). */
export const PRIMARY_CAMERA_SLOT = 1

export const CAM_SLOT_LABELS = [
  'CAM 1 · Izquierda',
  'CAM 2 · Centro',
  'CAM 3 · Derecha',
]

export function pickPrimaryActiveSlot(streams) {
  if (streams?.[PRIMARY_CAMERA_SLOT]) return PRIMARY_CAMERA_SLOT
  const first = [0, 1, 2].find((s) => streams?.[s])
  return first ?? PRIMARY_CAMERA_SLOT
}
