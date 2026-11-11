'use strict';
// Clasificación de errores de streaming (v1.5.1, Frentes B/D1).
// Extraído de electron/main.js para poder probarlo sin Electron
// (scripts/stream-error.test.mjs), con el mismo patrón CommonJS que
// electron/export-signature.js.
//
// classifyStreamError(text) devuelve uno de estos kinds:
//   'url'     — la plataforma rechazó la dirección de publicación
//               (p. ej. Facebook: "Publish Rejected: Invalid URL").
//   'encoder' — el codificador H.264 no pudo arrancar o murió.
//   'tls'     — fallo de TLS/SSL en el handshake RTMPS.
//   'auth'    — clave rechazada / sin autorización.
//   'network' — no se alcanzó el servidor (red, DNS, timeout, pipe roto).
//   'unknown' — ninguna regla casó.
// La regla 'url' va PRIMERA a propósito: el log real de la máquina del
// usuario ("[rtmps @ ...] Server error: Publish Rejected: Invalid URL")
// no casaba ninguna regla específica y caía en el genérico, ocultando que
// el problema era la URL/clave guardada, no la red ni el servidor.

function classifyStreamError(text) {
  const t = String(text || '');
  if (/invalid url|publish rejected/i.test(t)) return 'url';
  if (/h264_mf|libx264|x264|mediafoundation|encoder|codec|mft\b|avcodec|invalid argument.*video|no such encoder/i.test(t)) return 'encoder';
  if (/tls|ssl|handshake|certificate|schannel|gnutls|protocol not found|unsupported protocol/i.test(t)) return 'tls';
  if (/invalid.*(?:key|stream)|unauthor|access denied|forbidden|login|403|401/i.test(t)) return 'auth';
  if (/connection refused|timed out|timeout|unreachable|no route|failed to resolve|network|input\/output error|broken pipe/i.test(t)) return 'network';
  return 'unknown';
}

// Mensaje accionable por kind, en español, para mostrar en la UI junto al
// error técnico (que se conserva intacto en el campo `error`).
const STREAM_ERROR_USER_MESSAGES = {
  url: 'Facebook rechazó la dirección de publicación: revisa que el servidor no traiga la clave pegada ni la clave de una sesión cerrada',
  encoder: 'El codificador de vídeo falló al arrancar: el equipo no pudo iniciar la codificación H.264.',
  tls: 'La conexión segura (TLS) con el servidor de transmisión falló: revisa que la dirección del servidor sea la oficial de la plataforma.',
  auth: 'La plataforma rechazó la clave de transmisión: genera una clave nueva con el directo abierto y pégala en el destino.',
  network: 'No se pudo alcanzar el servidor de transmisión: revisa tu conexión a internet e inténtalo de nuevo.',
  unknown: 'La transmisión falló por un motivo no identificado: el detalle técnico quedó en el registro de transmisión.',
};

module.exports = { classifyStreamError, STREAM_ERROR_USER_MESSAGES };
