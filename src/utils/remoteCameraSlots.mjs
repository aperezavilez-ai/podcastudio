export const MAX_REMOTE_CAMERA_SLOTS = 12;

export function buildRemoteCameraUrl({
  baseUrl = 'https://www.podcastudio.mx/remote-cam',
  slotIndex = 0,
  guestName = '',
  guestRole = 'guest',
  autoAssign = false,
} = {}) {
  const url = new URL(baseUrl);
  if (autoAssign) {
    url.searchParams.set('auto', 'true');
  } else {
    const rawSlot = Number(slotIndex);
    const slot = (Number.isInteger(rawSlot) && rawSlot >= 0 && rawSlot < MAX_REMOTE_CAMERA_SLOTS)
      ? rawSlot
      : 0;
    const cameraNumber = slot + 1;
    url.searchParams.set('slot', String(cameraNumber));
    url.searchParams.set('room', `studio_cam_${cameraNumber}`);
  }
  if (guestName && guestName.trim()) url.searchParams.set('name', guestName.trim());
  if (guestRole && guestRole !== 'guest') url.searchParams.set('role', guestRole);
  return url.toString();
}

// Predicado ÚNICO de ocupación de ranura (v3.3.1): una ranura está
// ocupada si tiene señal (stream), reserva de metadatos (deviceId/url),
// una reserva del auto-despacho a nombre de OTRO dispositivo, o si es la
// ranura 1 con la señal local del anfitrión viva. Toda decisión de
// asignación (remotas, reconexiones) pasa por este mismo predicado: la
// v3.3.0 expulsaba cámaras porque cada camino decidía «libre» a su manera.
function crearPredicadoOcupacion({
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  return (slot) => Boolean(
    streams[slot]
    || cameraMeta[slot]?.deviceId
    || cameraMeta[slot]?.url
    || (assignedSlots[slot] && assignedSlots[slot] !== requestingDeviceId)
    || (slot === 0 && localStreamActive)
  );
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
  const isOccupied = crearPredicadoOcupacion({ streams, cameraMeta, assignedSlots, localStreamActive, requestingDeviceId });

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

// v3.3.1 (defecto 1) — asignación de una cámara REMOTA con ranura
// explícita pedida (el QR/enlace de una ranura concreta o la sala que
// trae la oferta): la explícita MANDA solo si está libre; si está
// ocupada, la remota va a la primera ranura libre — NUNCA expulsa a la
// ocupante (la v3.3.0 honraba la explícita sin mirar y pisaba la cámara
// que estuviera ahí, CAM 2 en la sesión de Luis). Sin explícita, manda
// la búsqueda de siempre (preferida 1, luego la primera libre).
export function resolveRemoteCameraSlot({
  explicitSlot = null,
  slotsCount = MAX_REMOTE_CAMERA_SLOTS,
  preferredSlot = 1,
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  const limit = Math.min(MAX_REMOTE_CAMERA_SLOTS, Math.max(0, Number(slotsCount) || 0));
  const isOccupied = crearPredicadoOcupacion({ streams, cameraMeta, assignedSlots, localStreamActive, requestingDeviceId });
  const explicit = Number(explicitSlot);
  if (Number.isInteger(explicit) && explicit >= 0 && explicit < limit && !isOccupied(explicit)) {
    return explicit;
  }
  return findAvailableRemoteCameraSlot({
    slotsCount,
    preferredSlot,
    streams,
    cameraMeta,
    assignedSlots,
    localStreamActive,
    requestingDeviceId,
  });
}

// v3.3.1 (defecto 2, reglas b y c) — ranura para RECONECTAR una cámara
// ya conocida (guardada): (b) recupera SU ranura anterior si está libre;
// (c) si no, la primera ranura libre en orden de ranuras. Nunca la
// última ni la mayor por defecto (la v3.3.0 mandó la EasyCamera a CAM 4
// con CAM 2 libre). Devuelve el ÍNDICE de ranura (0 = CAM 1) o null si
// no hay ninguna libre.
export function chooseReconnectCameraSlot({
  previousSlot = null,
  camSlots = [],
  streams = {},
  cameraMeta = {},
} = {}) {
  const indices = (Array.isArray(camSlots) ? camSlots : [])
    .map((n) => Number(n) - 1)
    .filter((i) => Number.isInteger(i) && i >= 0 && i < MAX_REMOTE_CAMERA_SLOTS);
  const estaLibre = (i) => !streams[i] && !cameraMeta[i]?.deviceId && !cameraMeta[i]?.url;
  const prev = Number(previousSlot);
  if (Number.isInteger(prev) && indices.includes(prev) && estaLibre(prev)) return prev;
  for (const i of indices) {
    if (estaLibre(i)) return i;
  }
  return null;
}
