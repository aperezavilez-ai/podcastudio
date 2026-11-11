import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeExportSignature, siblingSuffixFor } = require('../electron/export-signature.js');

const base = {
  sourcePath: 'D:/proyectos/Show/Show_Master_1080p.mp4',
  sourceSize: 123456789,
  filter: 'scale=1920:1080',
  mode: 'smart-crop',
  codecKey: 'libx264|ultrafast|crf18|maxrate8M|bufsize16M|yuv420p|audio-copy|faststart',
};

test('la firma es estable para parámetros idénticos (caso Facebook/YouTube 16:9)', () => {
  assert.equal(computeExportSignature(base), computeExportSignature({ ...base }));
});

test('la firma cambia si cambia cualquier parámetro de encode', () => {
  assert.notEqual(computeExportSignature(base), computeExportSignature({ ...base, filter: 'crop=ih:ih:(iw-ih)/2:0,scale=1080:1080' }));
  assert.notEqual(computeExportSignature(base), computeExportSignature({ ...base, sourceSize: 987 }));
  assert.notEqual(computeExportSignature(base), computeExportSignature({ ...base, mode: 'blur-fill' }));
  assert.notEqual(computeExportSignature(base), computeExportSignature({ ...base, codecKey: 'libx264|crf21' }));
});

test('Facebook 16:9 y YouTube 16:9 son hermanos de dedupe; el resto no', () => {
  assert.equal(siblingSuffixFor('YouTube_16x9'), 'Facebook_16x9');
  assert.equal(siblingSuffixFor('Facebook_16x9'), 'YouTube_16x9');
  assert.equal(siblingSuffixFor('TikTok_Reels_9x16'), null);
  assert.equal(siblingSuffixFor('Instagram_Feed_1x1'), null);
});
