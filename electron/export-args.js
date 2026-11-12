'use strict';
// ============================================================================
// Argumentos de exportación social — Hito 3 (v3.2.0). Módulo PURO.
//
// Antes, el handler «export-social-format» de main.js construía los
// argumentos de ffmpeg EN LÍNEA y SIEMPRE re-codificaba con libx264 por
// software (-preset ultrafast -crf 18): incluso el 16:9 mismo tamaño
// tardaba ~10× la duración del vídeo y la carpeta se llenaba de casi
// duplicados. Este módulo concentra la construcción en funciones puras
// y probadas (scripts/export-args.test.mjs):
//
//   · 16:9 al MISMO tamaño que el máster (1920×1080) = COPIA de flujos
//     + faststart (remux, segundos, sin re-codificar). El faststart
//     además hace que el Explorador de Windows genere la miniatura.
//   · Cualquier cambio de tamaño/aspecto = filtro crop/scale (las
//     cadenas EXACTAS que ya usaba el handler) + codificador de la
//     escalera de hardware sondeada una vez (h264_nvenc → h264_qsv →
//     h264_mf → libx264) con el MISMO bitrate por área que el motor
//     nativo (1080p→12, 1440p→20, 4K→40 Mbps).
//   · codecKey alimenta la firma de dedupe existente
//     (electron/export-signature.js): Facebook/YouTube 16:9 comparten
//     parámetros y la segunda salida se copia, como antes.
// ============================================================================

// Escalera de codificadores del ffmpeg empaquetado, en orden de
// preferencia. h264_nvenc quedó PROBADO en la máquina de Luis en la
// Fase 0 (150 fotogramas 720p a 93 fps, fuera de la app).
const FFMPEG_ENCODER_LADDER = ['h264_nvenc', 'h264_qsv', 'h264_mf', 'libx264'];

// probeExportEncoder(probeFn): probeFn(nombre) → boolean dice si el
// binario trae ese codificador (p. ej. buscando en «ffmpeg -encoders»).
// Devuelve el primero disponible de la escalera; libx264 siempre existe
// y es el último respaldo aunque la sonda devuelva todo falso.
function probeExportEncoder(probeFn) {
  if (typeof probeFn !== 'function') return 'libx264';
  for (const enc of FFMPEG_ENCODER_LADDER) {
    let ok = false;
    try { ok = !!probeFn(enc); } catch (e) { ok = false; }
    if (ok) return enc;
  }
  return 'libx264';
}

// La MISMA regla de bitrate que el motor nativo (bitrateParaCaps en
// electron/native-engine.js), por área de la imagen DESTINO:
// ≥3840×2160 → 40000; ≥2560×1440 → 20000; si no → 12000 (kbit/s).
function bitrateKbpsParaTamano(width, height) {
  const area = (width || 0) * (height || 0);
  if (area >= 3840 * 2160) return 40000;
  if (area >= 2560 * 1440) return 20000;
  return 12000;
}

// Cadenas de filtro — movidas verbatim del handler (no cambiar sin
// actualizar las pruebas): el modo de reencuadre viaja desde el modal.
function blurFillFiltro(W, H) {
  return `split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:5[bg];[b]scale=${W}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[vout]`;
}
const STACK_VERTICAL = '[0:v]crop=iw:ih/2:0:0,scale=1080:960[top];[0:v]crop=iw:ih/2:0:ih/2,scale=1080:960[bottom];[top][bottom]vstack=inputs=2,setsar=1[vout]';
const STACK_SQUARE = '[0:v]crop=iw/2:ih:0:0,scale=540:1080[left];[0:v]crop=iw/2:ih:iw/2:0,scale=540:1080[right];[left][right]hstack=inputs=2,setsar=1[vout]';

// filtroParaFormato(formatKey, cropMode) → { filter, useComplex,
// suffix, width, height }. 'smart-crop' es recorte central (no hay
// detección de sujeto); 'blur-fill' conserva el cuadro completo sobre
// fondo difuminado; 'split-stack' apila las dos mitades del cuadro.
function filtroParaFormato(formatKey, cropMode) {
  const mode = cropMode || 'smart-crop';
  if (formatKey === '9:16') {
    if (mode === 'blur-fill') return { filter: blurFillFiltro(1080, 1920), useComplex: true, suffix: 'TikTok_Reels_9x16', width: 1080, height: 1920 };
    if (mode === 'split-stack') return { filter: STACK_VERTICAL, useComplex: true, suffix: 'TikTok_Reels_9x16', width: 1080, height: 1920 };
    return { filter: 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920', useComplex: false, suffix: 'TikTok_Reels_9x16', width: 1080, height: 1920 };
  }
  if (formatKey === '1:1') {
    if (mode === 'blur-fill') return { filter: blurFillFiltro(1080, 1080), useComplex: true, suffix: 'Instagram_Feed_1x1', width: 1080, height: 1080 };
    if (mode === 'split-stack') return { filter: STACK_SQUARE, useComplex: true, suffix: 'Instagram_Feed_1x1', width: 1080, height: 1080 };
    return { filter: 'crop=ih:ih:(iw-ih)/2:0,scale=1080:1080', useComplex: false, suffix: 'Instagram_Feed_1x1', width: 1080, height: 1080 };
  }
  if (formatKey === '4:5') {
    if (mode === 'blur-fill') return { filter: blurFillFiltro(1080, 1350), useComplex: true, suffix: 'Facebook_Feed_4x5', width: 1080, height: 1350 };
    return { filter: 'crop=ih*4/5:ih:(iw-ih*4/5)/2:0,scale=1080:1350', useComplex: false, suffix: 'Facebook_Feed_4x5', width: 1080, height: 1350 };
  }
  if (formatKey === '16:9_yt') {
    return { filter: 'scale=1920:1080', useComplex: false, suffix: 'YouTube_16x9', width: 1920, height: 1080 };
  }
  // '16:9' y cualquier clave desconocida: Facebook 16:9 (como antes).
  return { filter: 'scale=1920:1080', useComplex: false, suffix: 'Facebook_16x9', width: 1920, height: 1080 };
}

// Argumentos del codificador según la escalera. h264_nvenc con preset
// p4 (equilibrio calidad/velocidad de la generación actual de NVENC);
// qsv/mf sin preset (sus superficies difieren); libx264 veryfast como
// respaldo de software (antes era ultrafast+crf: calidad peor y aun así
// lento porque re-codificaba TODO, incluido el 16:9).
function argsDeCodificador(encoder, kbps) {
  const br = ['-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`];
  if (encoder === 'h264_nvenc') return ['-c:v', 'h264_nvenc', '-preset', 'p4', ...br];
  if (encoder === 'h264_qsv') return ['-c:v', 'h264_qsv', ...br];
  if (encoder === 'h264_mf') return ['-c:v', 'h264_mf', ...br];
  return ['-c:v', 'libx264', '-preset', 'veryfast', ...br];
}

// buildExportArgs({ sourcePath, outPath, formatKey, cropMode, encoder,
// sourceWidth, sourceHeight }) → { args, filter, useComplex, suffix,
// width, height, copy, codecKey }.
//
// CASO COPIA: formatKey 16:9/16:9_yt + modo smart-crop + la fuente mide
// EXACTAMENTE 1920×1080 → -c copy + faststart (el entregable 16:9 ES el
// máster remuxado; no hay segunda copia del máster en ningún caso).
function buildExportArgs(opciones) {
  const o = opciones || {};
  const mode = o.cropMode || 'smart-crop';
  const f = filtroParaFormato(o.formatKey, mode);
  const es16x9 = o.formatKey === '16:9' || o.formatKey === '16:9_yt';
  const mismaMedida = o.sourceWidth === f.width && o.sourceHeight === f.height;
  if (es16x9 && mode === 'smart-crop' && mismaMedida) {
    return {
      args: ['-y', '-i', o.sourcePath, '-c', 'copy', '-movflags', '+faststart', o.outPath],
      filter: '', useComplex: false, suffix: f.suffix, width: f.width, height: f.height,
      copy: true, codecKey: 'copy|faststart',
    };
  }
  const encoder = FFMPEG_ENCODER_LADDER.includes(o.encoder) ? o.encoder : 'libx264';
  const kbps = bitrateKbpsParaTamano(f.width, f.height);
  const args = ['-y', '-i', o.sourcePath];
  if (f.useComplex) args.push('-filter_complex', f.filter, '-map', '[vout]', '-map', '0:a?');
  else args.push('-vf', f.filter);
  args.push(
    ...argsDeCodificador(encoder, kbps),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    o.outPath,
  );
  return {
    args, filter: f.filter, useComplex: f.useComplex, suffix: f.suffix,
    width: f.width, height: f.height, copy: false,
    codecKey: `${encoder}|br${kbps}|yuv420p|audio-copy|faststart`,
  };
}

module.exports = {
  FFMPEG_ENCODER_LADDER,
  probeExportEncoder,
  bitrateKbpsParaTamano,
  filtroParaFormato,
  buildExportArgs,
};
