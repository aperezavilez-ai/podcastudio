// ============================================================================
// Política del VIGILANTE DE READQUISICIÓN (v3.4.0) — funciones puras.
//
// Nació del fallo en vivo del 2026-11-13 (~15:19 MST): al DETENER la
// transmisión, CAM 1 y CAM 3 (liberadas al motor nativo) NO volvieron;
// solo quedó CAM 2. Mecanismo: readquirirLiberadas (App.jsx) intentaba
// la readquisición UNA sola vez al caer la fase a apagado/error; si la
// apertura fallaba (el proceso del motor aún no había soltado el
// dispositivo Media Foundation), el registro se restauraba «para
// reintentar al próximo apagado» — pero el motor YA estaba apagado y
// ningún cambio de estado volvía a disparar el efecto: las cámaras
// quedaban perdidas hasta reiniciar la app u otro ciclo del motor
// (por eso otras veces sí volvían: hacía falta un ciclo más).
//
// La política decide, para cada cámara pendiente de volver:
//  - 'esperar'   — el motor no está apagado/en error (sigue en sesión
//                  o en una transición): no se toca nada.
//  - 'intentar'  — motor apagado/error y aún quedan intentos: el
//                  vigilante (intervalo de 2 s en App.jsx) vuelve a
//                  ejecutar la readquisición.
//  - 'imposible' — se agotaron los intentos declarados (6 por cámara):
//                  se avisa UNA vez y el registro queda guardado para
//                  el próximo ciclo del motor, declarado — nunca un
//                  bucle infinito ni una pérdida silenciosa.
// ============================================================================

export const REACQUIRE_INTERVAL_MS = 2000;
export const REACQUIRE_MAX_ATTEMPTS = 6;
export const FASES_READQUISICION = ['apagado', 'error'];

export function decidirReintentoReadquisicion({ fase, intentos = 0, maxIntentos = REACQUIRE_MAX_ATTEMPTS } = {}) {
  if (!FASES_READQUISICION.includes(fase)) return 'esperar';
  const n = Number(intentos);
  if (Number.isFinite(n) && n >= maxIntentos) return 'imposible';
  return 'intentar';
}

// Entrada del mapa de intentos para una ranura (defecto: sin intentos
// y sin avisar). El mapa vive en un ref de App.jsx:
// { [slotIdx]: { count: number, avisado: boolean } }.
export function entradaIntentos(intentos, slotIdx) {
  const e = (intentos || {})[slotIdx];
  return {
    count: Number.isFinite(e?.count) ? e.count : 0,
    avisado: e?.avisado === true,
  };
}

// Devuelve un mapa NUEVO con un intento más contado para la ranura
// (sin mutar el recibido).
export function sumarIntentoReadquisicion(intentos, slotIdx) {
  const prev = entradaIntentos(intentos, slotIdx);
  return { ...(intentos || {}), [slotIdx]: { count: prev.count + 1, avisado: prev.avisado } };
}

// Devuelve un mapa NUEVO con la ranura marcada como avisada (el aviso
// de «no pudo volver tras N intentos» se da UNA sola vez por cámara).
export function marcarReadquisicionAvisada(intentos, slotIdx) {
  const prev = entradaIntentos(intentos, slotIdx);
  return { ...(intentos || {}), [slotIdx]: { count: prev.count, avisado: true } };
}

// Devuelve un mapa NUEVO sin la ranura: la cámara volvió (o su
// registro desapareció por desconexión manual) y su contabilidad de
// intentos se olvida.
export function olvidarIntentosReadquisicion(intentos, slotIdx) {
  if (!intentos || !(slotIdx in intentos)) return intentos || {};
  const copia = { ...intentos };
  delete copia[slotIdx];
  return copia;
}
