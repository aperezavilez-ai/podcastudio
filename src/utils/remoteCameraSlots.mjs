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

// v3.3.4 — FUENTES de ocupación de una ranura, como lista legible.
// Es la ÚNICA definición de «qué marca una ranura como ocupada» y la
// comparten el predicado de decisión y el instrumento de diagnóstico
// ([ranura] en ventana-diag.log): si mañana una decisión se discute,
// el log dice exactamente qué fuentes veía la guarda al decidir.
//   - 'stream': hay señal viva en el mapa de streams.
//   - 'meta': hay metadatos con deviceId/url (reserva de la cámara).
//   - 'liberada-al-motor': la cámara de la ranura está PRESTADA al
//     motor nativo (la dieta D2 detuvo sus tracks y la sacó del mapa
//     de streams mientras el motor la usa). La v3.3.3 no consultaba
//     este registro: con la vista previa/grabación del motor en
//     marcha, la ranura podía leerse «libre» en el instante en que
//     tampoco había meta que la sostuviera, la remota caía en ella y
//     la ocupante volvía DESPLAZADA a otra ranura. Regla de Luis:
//     una ranura prestada al motor está OCUPADA y BLOQUEADA; solo la
//     libera la desconexión manual de su cámara.
//   - 'reserva': el auto-despacho reservó la ranura para OTRO
//     dispositivo.
//   - 'local': es la ranura 1 con la señal local del anfitrión viva.
export function fuentesDeOcupacion(slot, {
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  liberadasAlMotor = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  const fuentes = [];
  if (streams[slot]) fuentes.push('stream');
  if (cameraMeta[slot]?.deviceId || cameraMeta[slot]?.url) fuentes.push('meta');
  if (liberadasAlMotor[slot]) fuentes.push('liberada-al-motor');
  if (assignedSlots[slot] && assignedSlots[slot] !== requestingDeviceId) fuentes.push('reserva');
  if (slot === 0 && localStreamActive) fuentes.push('local');
  return fuentes;
}

// Predicado ÚNICO de ocupación de ranura (v3.3.1; v3.3.4: construido
// sobre fuentesDeOcupacion y con la fuente «liberada-al-motor»): una
// ranura está ocupada si alguna fuente la marca. Toda decisión de
// asignación (remotas, reconexiones, readquisiciones) pasa por este
// mismo predicado: la v3.3.0 expulsaba cámaras porque cada camino
// decidía «libre» a su manera, y la v3.3.3 seguía expulsando porque
// la guarda no veía las cámaras prestadas al motor nativo.
function crearPredicadoOcupacion({
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  liberadasAlMotor = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  return (slot) => fuentesDeOcupacion(slot, {
    streams, cameraMeta, assignedSlots, liberadasAlMotor, localStreamActive, requestingDeviceId,
  }).length > 0;
}

export function findAvailableRemoteCameraSlot({
  slotsCount = MAX_REMOTE_CAMERA_SLOTS,
  preferredSlot = 1,
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  liberadasAlMotor = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  const limit = Math.min(MAX_REMOTE_CAMERA_SLOTS, Math.max(0, Number(slotsCount) || 0));
  const isOccupied = crearPredicadoOcupacion({ streams, cameraMeta, assignedSlots, liberadasAlMotor, localStreamActive, requestingDeviceId });

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
  liberadasAlMotor = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  const limit = Math.min(MAX_REMOTE_CAMERA_SLOTS, Math.max(0, Number(slotsCount) || 0));
  const isOccupied = crearPredicadoOcupacion({ streams, cameraMeta, assignedSlots, liberadasAlMotor, localStreamActive, requestingDeviceId });
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
    liberadasAlMotor,
    localStreamActive,
    requestingDeviceId,
  });
}

// v3.3.3 (defecto A — el 4º camino) — COLOCACIÓN de una cámara remota
// cloud con REUTILIZACIÓN idempotente por conexión. El transporte cloud
// (streamTransport.dispatchStreamUpdate) emite «streamConnected» en
// CADA actualización de pistas (ontrack de video, luego de audio,
// renegociaciones, onunmute…), no una sola vez por conexión; el
// handler del estudio (App.jsx, setupSlot) ejecutaba la colocación
// COMPLETA en cada emisión, claveada por la ranura de la SALA, sin
// preguntar «¿este celular ya quedó colocado?». En una re-emisión, si
// la ocupante no se veía en slotStreams/cameraMeta en ese instante
// (transición, readquisición del motor, pista aún sin registrar), el
// handler volvía a evaluar la ranura de la sala como si fuera nueva y
// pisaba a la ocupante — la v3.3.1 cubrió la PRIMERA colocación de
// tres caminos, pero no la re-emisión de este, y por eso la remota
// siguió cayendo en CAM 2 en vivo. Regla de Luis: una ranura ocupada
// queda BLOQUEADA; nadie la aborda ni expulsa a su ocupante.
// Esta función es el cerebro ÚNICO de la decisión, y todo camino de
// conexión remota debe pasar por ella:
//   - Si la sala ya tiene colocación viva ⇒ la re-emisión SOLO
//     actualiza el stream EN ESA ranura ya colocada (acción
//     'actualizar'), aunque el stream de la sala y la ocupante hayan
//     cambiado por completo: NUNCA se reevalúa ocupación, NUNCA se
//     escribe en otra ranura, NUNCA se detiene la pista de nadie.
//   - Si no hay colocación previa ⇒ manda resolveRemoteCameraSlot
//     (explícita solo si libre; si no, primera libre; la ocupante
//     queda intacta) y la colocación queda registrada para las
//     re-emisiones siguientes.
//   - Sin ranuras libres ⇒ 'rechazar': no se conecta y se declara.
// v3.3.4: la decisión recibe además «liberadasAlMotor» (el registro
// de cámaras prestadas al motor nativo): una ranura liberada cuenta
// como ocupada en la primera colocación, así el celular cae en la
// primera libre de verdad y la prestada queda intacta hasta que su
// cámara vuelve a SU ranura al apagarse el motor.
export function decidirColocacionRemotaCloud({
  sala = null,
  colocaciones = {},
  explicitSlot = null,
  slotsCount = MAX_REMOTE_CAMERA_SLOTS,
  preferredSlot = 1,
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  liberadasAlMotor = {},
  localStreamActive = false,
  requestingDeviceId,
} = {}) {
  const salaNum = Number(sala);
  if (Number.isInteger(salaNum)) {
    const previa = Number(colocaciones?.[salaNum]);
    if (Number.isInteger(previa) && previa >= 0 && previa < MAX_REMOTE_CAMERA_SLOTS) {
      return { accion: 'actualizar', placedSlot: previa, reemision: true };
    }
  }
  const placedSlot = resolveRemoteCameraSlot({
    explicitSlot,
    slotsCount,
    preferredSlot,
    streams,
    cameraMeta,
    assignedSlots,
    liberadasAlMotor,
    localStreamActive,
    requestingDeviceId,
  });
  if (placedSlot === null) {
    return { accion: 'rechazar', placedSlot: null, reemision: false };
  }
  return {
    accion: 'colocar',
    placedSlot,
    reemision: false,
    reubicada: Number.isInteger(Number(explicitSlot)) && Number(explicitSlot) !== placedSlot,
  };
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
  liberadasAlMotor = {},
} = {}) {
  const indices = (Array.isArray(camSlots) ? camSlots : [])
    .map((n) => Number(n) - 1)
    .filter((i) => Number.isInteger(i) && i >= 0 && i < MAX_REMOTE_CAMERA_SLOTS);
  // v3.3.4: una ranura con cámara prestada al motor tampoco está
  // libre para una reconexión: su dueña volverá a ella.
  const estaLibre = (i) => !streams[i] && !cameraMeta[i]?.deviceId && !cameraMeta[i]?.url && !liberadasAlMotor[i];
  const prev = Number(previousSlot);
  if (Number.isInteger(prev) && indices.includes(prev) && estaLibre(prev)) return prev;
  for (const i of indices) {
    if (estaLibre(i)) return i;
  }
  return null;
}

// v3.3.4 — destino de READQUISICIÓN de una cámara que vuelve del
// motor nativo (la dieta D2 la readquiere al apagarse el motor). La
// cámara recupera SU ranura original si está libre según el
// predicado ÚNICO (todas las fuentes); si mientras estaba prestada
// otra fuente ocupó su ranura (tras esta versión ya no puede ser una
// remota — la guarda la bloquea — pero sí una conexión manual del
// usuario), se reubica a la primera libre en orden de ranura y la
// ocupante queda intacta: la readquisición JAMÁS sobrescribe. Sin
// ninguna libre ⇒ slot null (la cámara no vuelve todavía; su
// registro de liberada se conserva y reintentará en el próximo
// apagado). El llamador decide con un mapa «liberadasAlMotor» del
// que ya retiró el registro de ESTA cámara (su propia liberación no
// la bloquea a ella misma; las de las demás sí).
export function elegirRanuraReadquisicion({
  ranuraOriginal = null,
  slotsCount = MAX_REMOTE_CAMERA_SLOTS,
  streams = {},
  cameraMeta = {},
  assignedSlots = {},
  liberadasAlMotor = {},
  localStreamActive = false,
} = {}) {
  const limit = Math.min(MAX_REMOTE_CAMERA_SLOTS, Math.max(0, Number(slotsCount) || 0));
  const isOccupied = crearPredicadoOcupacion({ streams, cameraMeta, assignedSlots, liberadasAlMotor, localStreamActive });
  const orig = Number(ranuraOriginal);
  if (Number.isInteger(orig) && orig >= 0 && orig < limit && !isOccupied(orig)) {
    return { slot: orig, reubicada: false };
  }
  for (let s = 0; s < limit; s += 1) {
    if (!isOccupied(s)) return { slot: s, reubicada: Number.isInteger(orig) ? s !== orig : true };
  }
  return { slot: null, reubicada: true };
}
