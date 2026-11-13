'use strict';
// ============================================================================
// Núcleo PURO del instrumento de diagnóstico de ventana (build diagnóstica
// posterior a la v3.2.4 — NO es una release).
//
// La v3.2.4 no arregló en vivo ni la traba al cambiar de ventana ni el
// teleprompter, aunque su diagnóstico «en código» era plausible. Este módulo
// concentra la matemática y el formato del registro ventana-diag.log para
// poder probarlos sin Electron (scripts/ventana-diag.test.mjs):
//
//   · formatDiagLine: una línea de log = [ISO] [prefijo] texto.
//   · createPingAggregator: el renderer manda un ping cada `expectedMs`;
//     main anota la hora de LLEGADA de cada ping. El retraso de un ping es
//     cuánto se pasó su hueco real respecto al ritmo esperado: si el hilo
//     del renderer se cuelga, sus temporizadores se disparan tarde (o de
//     golpe) y los pings llegan tarde: el retraso de llegada ES la medida
//     de la traba, sin tocar el comportamiento medido. El agregado vuelca
//     una vez por segundo el retraso máximo del último segundo.
// ============================================================================

function formatDiagLine(isoTs, prefix, text) {
  return `[${isoTs}] [${prefix}] ${text}`;
}

function createPingAggregator(expectedMs = 500) {
  const expected = Number.isFinite(expectedMs) && expectedMs > 0 ? expectedMs : 500;
  let lastArrivalAt = null; // hora (ms) del último ping, persiste entre volcados
  let windowPings = 0;      // pings recibidos en la ventana actual
  let windowMaxDelayMs = null; // retraso máximo de la ventana actual

  return {
    // Registra la llegada de un ping en `nowMs` (reloj de main).
    push(nowMs) {
      const now = Number(nowMs);
      if (!Number.isFinite(now)) return;
      windowPings += 1;
      if (lastArrivalAt != null) {
        const gap = now - lastArrivalAt;
        const delay = Math.max(0, gap - expected);
        if (windowMaxDelayMs == null || delay > windowMaxDelayMs) {
          windowMaxDelayMs = delay;
        }
      }
      lastArrivalAt = now;
    },
    // Cierra la ventana: devuelve { pings, maxDelayMs } y reinicia los
    // contadores de la ventana (la marca del último ping se conserva: el
    // hueco entre el último ping de una ventana y el primero de la
    // siguiente pertenece a la ventana en la que el ping llega).
    flush() {
      const out = { pings: windowPings, maxDelayMs: windowMaxDelayMs };
      windowPings = 0;
      windowMaxDelayMs = null;
      return out;
    },
  };
}

module.exports = { formatDiagLine, createPingAggregator };
