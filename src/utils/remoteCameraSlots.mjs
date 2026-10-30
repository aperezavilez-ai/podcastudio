export const MAX_REMOTE_CAMERA_SLOTS = 12;

export function buildRemoteCameraUrl({
  baseUrl = 'https://www.podcastudio.mx/remote-cam',
  slotIndex,
  guestName = '',
  guestRole = 'guest',
  autoAssign = false,
} = {}) {
  const url = new URL(baseUrl);
  if (autoAssign) {
    url.searchParams.set('auto', 'true');
  } else {
    const slot = Number(slotIndex);
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_REMOTE_CAMERA_SLOTS) {
      throw new RangeError(`slotIndex must be between 0 and ${MAX_REMOTE_CAMERA_SLOTS - 1}`);
    }
    const cameraNumber = slot + 1;
    url.searchParams.set('slot', String(cameraNumber));
    url.searchParams.set('room', `studio_cam_${cameraNumber}`);
  }
  if (guestName.trim()) url.searchParams.set('name', guestName.trim());
  if (guestRole && guestRole !== 'guest') url.searchParams.set('role', guestRole);
  return url.toString();
}

export function findAvailableRemoteCameraSlot({
  slotsCount = MAX_REMOTE_CAMERA_SLOTS,
  preferredSlot = 1,
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  const limit = Math.min(MAX_REMOTE_CAMERA_SLOTS, Math.max(0, Number(slotsCount) || 0));
  const isOccupied = (slot) => Boolean(
    streams[slot]
    || cameraMeta[slot]?.deviceId
    || cameraMeta[slot]?.url
    || (assignedSlots[slot] && assignedSlots[slot] !== requestingDeviceId)
    || (slot === 0 && localStreamActive)
  );

  // Repeated requests from one phone reuse its reservation instead of taking another slot.
  const existingReservation = Object.entries(assignedSlots)
    .find(([slot, deviceId]) => deviceId === requestingDeviceId && Number(slot) < limit);
  if (existingReservation) return Number(existingReservation[0]);

  const preferred = Number(preferredSlot);
  if (Number.isInteger(preferred) && preferred > 0 && preferred < limit && !isOccupied(preferred)) {
    return preferred;
  }

  // Keep the host camera in CAM 1 when possible; remote cameras prefer CAM 2 onward.
  for (let slot = 1; slot < limit; slot += 1) {
    if (!isOccupied(slot)) return slot;
  }

  if (limit > 0 && !isOccupied(0)) return 0;
  return null;
}
