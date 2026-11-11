'use strict';
// Firma de parámetros de exportación (v1.5.0, Frente B).
// Facebook 16:9 y YouTube 16:9 comparten TODOS los parámetros de encode
// (filtro scale=1920:1080, códec, CRF, topes): codificar dos veces el mismo
// resultado es trabajo y tiempo tirados. Esta firma identifica encodes
// equivalentes para codificar una vez y copiar el archivo al segundo destino.
// Módulo puro y testeable (sin dependencias de Electron ni de fs).

function computeExportSignature({ sourcePath, sourceSize, filter, mode, codecKey }) {
  return [
    String(sourcePath || ''),
    String(sourceSize || 0),
    String(filter || ''),
    String(mode || ''),
    String(codecKey || ''),
  ].join('|');
}

// Pares de formatos cuyos parámetros son idénticos salvo el nombre de archivo.
const DEDUPE_SIBLINGS = {
  YouTube_16x9: 'Facebook_16x9',
  Facebook_16x9: 'YouTube_16x9',
};

function siblingSuffixFor(suffix) {
  return DEDUPE_SIBLINGS[suffix] || null;
}

module.exports = { computeExportSignature, siblingSuffixFor };
