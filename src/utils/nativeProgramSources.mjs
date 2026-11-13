// ============================================================================
// Composición de fuentes para el motor nativo (v3.3.1, defecto 4).
//
// Regla de Luis: la transmisión/grabación nativa sale SIEMPRE desde la
// cámara de PROGRAMA — la que lleva el tally PGM en el estudio
// (activeCam; por defecto CAM 1) — nunca desde «la última conectada» ni
// desde la primera que resulte elegible. La v3.3.0 ordenaba «la activa
// primero» sobre la lista de elegibles: si la de programa no pasaba un
// filtro (sin track vivo en ese instante, p. ej.), la primera elegible
// ocupaba su lugar EN SILENCIO y la sesión salía de otra cámara (en la
// sesión de Luis, de la EasyCamera en vez de su cámara de programa).
//
// Contrato:
//  - `programa` = { camId, etiqueta } de la ranura PGM si esa ranura
//    tiene una cámara LOCAL elegible (stream vivo, no remota); si no,
//    `programa` es null y `sources` viene vacía: el llamador NO debe
//    arrancar la sesión ni promover a otra cámara (se detiene antes,
//    con el motivo en la banda del motor).
//  - Con programa, `sources[0]` es su etiqueta (programIndex 0).
//  - v3.4.0 (orden de Luis): la PiP NO entra sola. Hasta la v3.3.6
//    TODAS las demás cámaras locales elegibles entraban como PiP en
//    orden de ranura (en su Facebook se vio una PiP que él no pidió).
//    Desde la v3.4.0 solo entra la ranura que Luis haya FIJADO como
//    PiP (pipCamId), si es elegible y no es la de programa; sin PiP
//    fijada, la sesión nace SOLO con la cámara de programa.
//  - v3.4.0 (identidad por etiqueta de pista): el nombre de cada
//    fuente se elige de las MISMAS candidatas que usa el emparejador
//    de liberación de la dieta (App.jsx): primero la etiqueta de la
//    pista de vídeo, luego meta.label, luego meta.videoInfo.label —
//    y NUNCA el deviceId: una candidata con forma de GUID (o igual al
//    deviceId guardado) se DESCARTA y se pasa a la siguiente. En vivo
//    (2026-11-13) una fuente llegó al motor nombrada por un GUID
//    («25203b73-…») que no casa con ninguna entrada de la enumeración
//    Media Foundation: el motor la omitió («Fuente PiP … OMITIDA») y
//    grabar con esa cámara de programa fue rechazado. Si ninguna
//    candidata es un nombre válido, la ranura no es elegible.
//  - Las ranuras REMOTAS quedan fuera siempre: el motor nativo solo
//    abre cámaras físicas locales (meta type 'remote' o stream con
//    mobileId del transporte cloud).
// ============================================================================

export const MAX_NATIVE_SOURCES = 3;

// Forma de GUID (8-4-4-4-12 hexadecimal): los deviceId de Chromium
// tienen esta forma y JAMÁS son el nombre de una cámara.
const PATRON_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esNombreFuenteValido(nombre, deviceId) {
  const n = String(nombre || '').trim();
  if (!n) return false;
  if (PATRON_GUID.test(n)) return false;
  if (deviceId && n === String(deviceId).trim()) return false;
  return true;
}

// Primera candidata que es un nombre de cámara válido, en el orden
// dado; null si ninguna lo es.
export function elegirEtiquetaFuente(candidatas, deviceId) {
  for (const c of candidatas || []) {
    const n = String(c || '').trim();
    if (esNombreFuenteValido(n, deviceId)) return n;
  }
  return null;
}

function etiquetaLocalElegible(slotIdx, { cameraMeta = {}, slotStreams = {}, localStream = null, releasedLabels = {} } = {}) {
  const meta = cameraMeta?.[slotIdx] || {};
  if (meta?.type === 'remote') return null;
  const stream = slotStreams?.[slotIdx] || (slotIdx === 0 ? localStream : null);
  if (!stream || stream.mobileId) {
    // Sin stream en la ventana: durante una sesión nativa, la dieta
    // LIBERA las cámaras del motor (detiene sus tracks y las saca del
    // mapa) guardando su etiqueta. Esa cámara sigue siendo una fuente
    // local del estudio — está en el motor — y cuenta como elegible
    // con la etiqueta guardada (clave para componer las subidas y los
    // reinicios de sesión sin «perder» la de programa). La etiqueta
    // guardada pasa por el mismo filtro: si fuera un GUID, no vale.
    return elegirEtiquetaFuente([releasedLabels?.[slotIdx]], meta?.deviceId);
  }
  const tracks = stream.getVideoTracks?.() || [];
  const hayPistaViva = tracks.some((t) => t && t.readyState === 'live');
  if (!hayPistaViva) return null;
  // Las MISMAS candidatas del emparejador de liberación (App.jsx):
  // etiqueta de la pista de vídeo primero, luego la etiqueta
  // guardada en la meta y luego la de videoInfo.
  const vTrack = tracks[0];
  return elegirEtiquetaFuente([vTrack && vTrack.label, meta?.label, meta?.videoInfo?.label], meta?.deviceId);
}

export function componerFuentesPrograma({
  camSlots = [],
  programaCamId = 1,
  pipCamId = null,
  cameraMeta = {},
  slotStreams = {},
  localStream = null,
  releasedLabels = {},
  maxFuentes = MAX_NATIVE_SOURCES,
} = {}) {
  const ctx = { cameraMeta, slotStreams, localStream, releasedLabels };
  const camIdPrograma = Number.isInteger(programaCamId) && programaCamId >= 1 ? programaCamId : 1;
  const programaSlot = camIdPrograma - 1;
  const etiquetaPrograma = etiquetaLocalElegible(programaSlot, ctx);
  if (!etiquetaPrograma) {
    return { sources: [], programa: null, programaSlot, etiquetaPrograma: null, pip: null };
  }
  const sources = [etiquetaPrograma];
  // v3.4.0 — PiP SOLO si Luis la fijó (pipCamId): ninguna otra cámara
  // entra a la sesión por su cuenta. La fijada entra si es elegible,
  // no es la de programa y su etiqueta no duplica la de programa.
  let pip = null;
  const camIdPip = Number.isInteger(pipCamId) && pipCamId >= 1 ? pipCamId : null;
  if (camIdPip && camIdPip !== camIdPrograma && sources.length < maxFuentes) {
    const etiquetaPip = etiquetaLocalElegible(camIdPip - 1, ctx);
    if (etiquetaPip && !sources.includes(etiquetaPip)) {
      sources.push(etiquetaPip);
      pip = { camId: camIdPip, etiqueta: etiquetaPip };
    }
  }
  return {
    sources,
    programa: { camId: camIdPrograma, etiqueta: etiquetaPrograma },
    programaSlot,
    etiquetaPrograma,
    pip,
  };
}
