// ============================================================================
// Pruebas del constructor puro de argumentos de exportación (Hito 3,
// v3.2.0) — electron/export-args.js.
//
// Sustituye la construcción en línea que vivía en el handler
// «export-social-format» de main.js (siempre libx264 por software,
// incluso para el 16:9 al mismo tamaño que el máster). Todo es puro:
// ningún ffmpeg real se ejecuta en estas pruebas.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  FFMPEG_ENCODER_LADDER,
  probeExportEncoder,
  bitrateKbpsParaTamano,
  filtroParaFormato,
  buildExportArgs,
} = require('../electron/export-args.js');

const SRC = 'C:\\proyectos\\Demo\\Demo_2026-11-12_15-30-00_Master_1080p.mp4';
const OUT = 'C:\\proyectos\\Demo\\salida.mp4';

test('export: 16:9 al tamaño del máster (1920×1080) es COPIA de flujos + faststart, sin codificador', () => {
  const b = buildExportArgs({
    sourcePath: SRC, outPath: OUT, formatKey: '16:9', cropMode: 'smart-crop',
    encoder: 'h264_nvenc', sourceWidth: 1920, sourceHeight: 1080,
  });
  assert.equal(b.copy, true);
  assert.deepEqual(b.args, ['-y', '-i', SRC, '-c', 'copy', '-movflags', '+faststart', OUT]);
  assert.ok(!b.args.includes('-c:v'));
  assert.equal(b.suffix, 'Facebook_16x9');
  assert.equal(b.codecKey, 'copy|faststart');
});

test('export: 16:9_yt al tamaño del máster también es copia (y el dedupe comparte firma con Facebook)', () => {
  const fb = buildExportArgs({ sourcePath: SRC, outPath: OUT, formatKey: '16:9', cropMode: 'smart-crop', encoder: 'h264_nvenc', sourceWidth: 1920, sourceHeight: 1080 });
  const yt = buildExportArgs({ sourcePath: SRC, outPath: OUT, formatKey: '16:9_yt', cropMode: 'smart-crop', encoder: 'h264_nvenc', sourceWidth: 1920, sourceHeight: 1080 });
  assert.equal(yt.copy, true);
  assert.equal(yt.suffix, 'YouTube_16x9');
  assert.equal(yt.codecKey, fb.codecKey);
});

test('export: 16:9 desde un máster 4K NO es copia: escala y codifica con la escalera', () => {
  const b = buildExportArgs({
    sourcePath: SRC, outPath: OUT, formatKey: '16:9', cropMode: 'smart-crop',
    encoder: 'h264_nvenc', sourceWidth: 3840, sourceHeight: 2160,
  });
  assert.equal(b.copy, false);
  assert.ok(b.args.includes('-vf'));
  assert.ok(b.args.includes('scale=1920:1080'));
  assert.ok(b.args.includes('h264_nvenc'));
  assert.ok(b.args.includes('12000k'));
});

test('export: 9:16 smart-crop codifica con el filtro histórico y bitrate 12000', () => {
  const b = buildExportArgs({
    sourcePath: SRC, outPath: OUT, formatKey: '9:16', cropMode: 'smart-crop',
    encoder: 'h264_nvenc', sourceWidth: 1920, sourceHeight: 1080,
  });
  assert.equal(b.copy, false);
  assert.equal(b.filter, 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920');
  assert.equal(b.useComplex, false);
  assert.equal(b.suffix, 'TikTok_Reels_9x16');
  const i = b.args.indexOf('-c:v');
  assert.equal(b.args[i + 1], 'h264_nvenc');
  assert.ok(b.args.includes('-b:v'));
  assert.ok(b.args.includes('12000k'));
  assert.ok(b.args.includes('+faststart'));
  assert.ok(b.args.includes('copy') && b.args[b.args.indexOf('-c:a') + 1] === 'copy');
});

test('export: 9:16 blur-fill usa filter_complex con mapa [vout] (cadena histórica verbatim)', () => {
  const b = buildExportArgs({
    sourcePath: SRC, outPath: OUT, formatKey: '9:16', cropMode: 'blur-fill',
    encoder: 'h264_qsv', sourceWidth: 1920, sourceHeight: 1080,
  });
  assert.equal(b.useComplex, true);
  assert.ok(b.args.includes('-filter_complex'));
  assert.ok(b.args.includes('-map'));
  assert.ok(b.args.includes('[vout]'));
  assert.ok(b.filter.startsWith('split[a][b];[a]scale=1080:1920'));
  assert.equal(b.args[b.args.indexOf('-c:v') + 1], 'h264_qsv');
});

test('export: 1:1 codifica a 1080×1080 con bitrate 12000 y sufijo de Instagram', () => {
  const b = buildExportArgs({
    sourcePath: SRC, outPath: OUT, formatKey: '1:1', cropMode: 'smart-crop',
    encoder: 'libx264', sourceWidth: 1920, sourceHeight: 1080,
  });
  assert.equal(b.filter, 'crop=ih:ih:(iw-ih)/2:0,scale=1080:1080');
  assert.equal(b.suffix, 'Instagram_Feed_1x1');
  assert.ok(b.args.includes('12000k'));
  assert.equal(b.args[b.args.indexOf('-c:v') + 1], 'libx264');
  assert.ok(b.args.includes('veryfast'));
});

test('export: bitrate por área sigue la escalera del motor (12/20/40 Mbps)', () => {
  assert.equal(bitrateKbpsParaTamano(1920, 1080), 12000);
  assert.equal(bitrateKbpsParaTamano(2560, 1440), 20000);
  assert.equal(bitrateKbpsParaTamano(3840, 2160), 40000);
  assert.equal(bitrateKbpsParaTamano(1080, 1920), 12000);
});

test('export: la sonda de codificadores respeta el orden de la escalera', () => {
  assert.deepEqual(FFMPEG_ENCODER_LADDER, ['h264_nvenc', 'h264_qsv', 'h264_mf', 'libx264']);
  assert.equal(probeExportEncoder(() => true), 'h264_nvenc');
  assert.equal(probeExportEncoder((e) => e === 'h264_qsv' || e === 'libx264'), 'h264_qsv');
  assert.equal(probeExportEncoder((e) => e === 'h264_mf'), 'h264_mf');
  assert.equal(probeExportEncoder(() => false), 'libx264');
  assert.equal(probeExportEncoder(null), 'libx264');
});

test('export: filtroParaFormato conserva sufijos y dimensiones de los presets del modal', () => {
  assert.equal(filtroParaFormato('16:9', 'smart-crop').suffix, 'Facebook_16x9');
  assert.equal(filtroParaFormato('16:9_yt', 'smart-crop').suffix, 'YouTube_16x9');
  assert.equal(filtroParaFormato('9:16', 'smart-crop').suffix, 'TikTok_Reels_9x16');
  assert.equal(filtroParaFormato('1:1', 'smart-crop').suffix, 'Instagram_Feed_1x1');
  assert.equal(filtroParaFormato('4:5', 'smart-crop').suffix, 'Facebook_Feed_4x5');
  const f45 = filtroParaFormato('4:5', 'smart-crop');
  assert.equal(f45.width, 1080);
  assert.equal(f45.height, 1350);
});
