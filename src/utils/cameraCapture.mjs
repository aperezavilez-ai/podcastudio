// cameraCapture.mjs
// Lógica PURA de captura de cámaras USB (sin DOM, testeable en node).
//
// Causa raíz (informe-1-camaras-usb.md §1): todas las cámaras se pedían a
// 1080p con constraints «ideal» y piso de 15 fps, sin presupuesto de bus y
// sin escalón intermedio: el driver entregaba lo que quería (a veces
// 1080p YUY2 a 5-15 fps, que satura USB 2.0) y la app lo aceptaba tal cual.
//
// Corrección de raíz que implementa este módulo:
//  - Escalera explícita de perfiles 1080p30 → 720p30 → 480p30.
//  - Presupuesto de bus: como máximo MAX_CAMERAS_1080 cámaras a 1080p.
//  - Medición posterior a la apertura: si lo entregado no cumple (fps,
//    resolución o ausencia de fotogramas), se baja un escalón. Nunca se
//    baja fps antes que resolución: 720p30 siempre antes que 1080p15.
// App.jsx consume este contrato; aquí no se toca getUserMedia ni el DOM.

export const CAPTURE_PROFILES = [
  { id: '1080p30', width: 1920, height: 1080, frameRate: 30 },
  { id: '720p30', width: 1280, height: 720, frameRate: 30 },
  { id: '480p30', width: 854, height: 480, frameRate: 30 },
];

// Máximo de cámaras simultáneas a 1080p (presupuesto de bus USB).
export const MAX_CAMERAS_1080 = 2;

export function profileById(id) {
  if (!id) return null;
  return CAPTURE_PROFILES.find((p) => p.id === id) || null;
}

export function profileIndex(id) {
  if (!id) return -1;
  return CAPTURE_PROFILES.findIndex((p) => p.id === id);
}

// Acepta un perfil como objeto ({id,...}) o como id en texto.
function resolveProfile(profile) {
  if (!profile) return null;
  if (typeof profile === 'string') return profileById(profile);
  if (typeof profile === 'object') return profileById(profile.id) || profile;
  return null;
}

// idsAt1080 puede venir como Array o como Set.
function idsAt1080Contains(idsAt1080, camId) {
  if (!idsAt1080 || camId == null) return false;
  if (typeof idsAt1080.has === 'function') return idsAt1080.has(camId);
  if (Array.isArray(idsAt1080)) return idsAt1080.includes(camId);
  return false;
}

function idsAt1080Count(idsAt1080) {
  if (!idsAt1080) return 0;
  if (typeof idsAt1080.size === 'number') return idsAt1080.size;
  if (Array.isArray(idsAt1080)) return idsAt1080.length;
  return 0;
}

export function nextProfileDown(profileId) {
  const id = profileId && typeof profileId === 'object' ? profileId.id : profileId;
  const idx = profileIndex(id);
  if (idx < 0 || idx >= CAPTURE_PROFILES.length - 1) return null;
  return CAPTURE_PROFILES[idx + 1];
}

// Perfil inicial para una cámara que se va a abrir:
//  - Con perfil guardado: se respeta, salvo que sea 1080p30 y el
//    presupuesto de 1080 ya esté lleno con OTRAS cámaras → 720p30.
//  - Sin guardado (o guardado desconocido): 1080p30 si hay presupuesto,
//    si no 720p30.
export function chooseInitialProfile({ savedProfileId, idsAt1080, camId } = {}) {
  const saved = profileById(savedProfileId);
  const budgetFull = idsAt1080Count(idsAt1080) >= MAX_CAMERAS_1080;
  const alreadyAt1080 = idsAt1080Contains(idsAt1080, camId);

  if (saved) {
    if (saved.id !== '1080p30' || !budgetFull || alreadyAt1080) return saved;
    return profileById('720p30');
  }
  if (!budgetFull || alreadyAt1080) return profileById('1080p30');
  return profileById('720p30');
}

// Evalúa la medición real tras abrir (o renegociar) una cámara y decide
// si el perfil se sostiene o baja un escalón.
//  - measuredFps === 0: no llegó ningún fotograma en la ventana.
//  - fps > 0 pero < 24 habiendo pedido 30: el driver se asentó bajo
//    (p. ej. 15 fps por saturación de bus) → bajar resolución, no fps.
//  - Ancho entregado < 85% del pedido: el driver no dio la resolución.
// En el último escalón (480p30) siempre se mantiene: no hay a dónde bajar.
// Para 'keep', nextProfile es el propio perfil vigente.
export function evaluateMeasurement({ profile, measuredFps, measuredWidth, measuredHeight } = {}) {
  const current = resolveProfile(profile);
  if (!current) return { action: 'keep', nextProfile: null, reason: 'ok' };

  const next = nextProfileDown(current.id);
  if (!next) {
    return { action: 'keep', nextProfile: current, reason: 'ok' };
  }

  const fps = typeof measuredFps === 'number' ? measuredFps : null;
  if (fps === 0) {
    return { action: 'downgrade', nextProfile: next, reason: 'sin-fotogramas' };
  }
  if (fps != null && fps > 0 && fps < 24 && current.frameRate >= 30) {
    return { action: 'downgrade', nextProfile: next, reason: 'fps-bajo' };
  }
  const width = typeof measuredWidth === 'number' ? measuredWidth : 0;
  if (width > 0 && width < current.width * 0.85) {
    return { action: 'downgrade', nextProfile: next, reason: 'resolucion-menor' };
  }
  return { action: 'keep', nextProfile: current, reason: 'ok' };
}

// Constraints para getUserMedia en un escalón de la escalera.
// width/height van EXACTOS a propósito: la escalera se apoya en medir lo
// entregado y en que un OverconstrainedError baja un escalón, no en
// «ideal», que era la causa raíz del forense — con «ideal» el driver
// entregaba cualquier modo (1080p a 15 fps incluido) y la app lo tomaba
// como éxito sin poder distinguirlo ni renegociarlo.
// frameRate queda como ideal+max: se pide 30 y se prohíbe pasar de 30,
// pero no se fuerza exacto para no chocar con cámaras de 29.97 reales;
// el fps entregado se verifica después con evaluateMeasurement().
export function buildVideoConstraints(profile, deviceId) {
  const resolved = resolveProfile(profile);
  if (!resolved) return null;
  const constraints = {};
  if (deviceId) constraints.deviceId = { exact: deviceId };
  constraints.width = { exact: resolved.width };
  constraints.height = { exact: resolved.height };
  constraints.frameRate = { ideal: resolved.frameRate, max: resolved.frameRate };
  return constraints;
}
