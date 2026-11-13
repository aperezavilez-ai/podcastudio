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
//  - Con programa, `sources[0]` es su etiqueta (programIndex 0) y las
//    demás cámaras locales elegibles entran como PiP EN ORDEN DE
//    RANURA, hasta el máximo vigente de 3 fuentes.
//  - Las ranuras REMOTAS quedan fuera siempre: el motor nativo solo
//    abre cámaras físicas locales (meta type 'remote' o stream con
//    mobileId del transporte cloud).
// ============================================================================

export const MAX_NATIVE_SOURCES = 3;

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
    // reinicios de sesión sin «perder» la de programa).
    const liberada = String(releasedLabels?.[slotIdx] || '').trim();
    return liberada || null;
  }
  const tracks = stream.getVideoTracks?.() || [];
  const vTrack = tracks.find((t) => t.readyState === 'live') || tracks[0];
  if (!vTrack || vTrack.readyState === 'ended') return null;
  const etiqueta = String(vTrack.label || meta?.label || meta?.videoInfo?.label || '').trim();
  return etiqueta || null;
}

export function componerFuentesPrograma({
  camSlots = [],
  programaCamId = 1,
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
    return { sources: [], programa: null, programaSlot, etiquetaPrograma: null };
  }
  const sources = [etiquetaPrograma];
  const idsOrdenados = [...(Array.isArray(camSlots) ? camSlots : [])]
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
  for (const id of idsOrdenados) {
    if (sources.length >= maxFuentes) break;
    const slotIdx = id - 1;
    if (slotIdx === programaSlot) continue;
    const etiqueta = etiquetaLocalElegible(slotIdx, ctx);
    if (etiqueta && !sources.includes(etiqueta)) sources.push(etiqueta);
  }
  return {
    sources,
    programa: { camId: camIdPrograma, etiqueta: etiquetaPrograma },
    programaSlot,
    etiquetaPrograma,
  };
}
