// Perfiles de programa (v3.0.0, Motor PodcastStudio): tabla exacta,
// tope de salida de streaming a 1080p, fallback e isUplinkCapped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRAM_PROFILES,
  PROGRAM_PROFILE_IDS,
  DEFAULT_PROGRAM_PROFILE_ID,
  getProgramProfile,
  isUplinkCapped,
} from '../src/utils/programProfiles.mjs';

test('tabla exacta de perfiles', () => {
  assert.deepEqual(PROGRAM_PROFILE_IDS, ['1080p', '1440p', '2160p']);
  assert.equal(DEFAULT_PROGRAM_PROFILE_ID, '1080p');

  const p1080 = PROGRAM_PROFILES['1080p'];
  assert.equal(p1080.label, '1080p Full HD');
  assert.equal(p1080.width, 1920); assert.equal(p1080.height, 1080);
  assert.equal(p1080.fps, 30);
  assert.equal(p1080.masterBitrateBps, 10_000_000);
  assert.equal(p1080.streamBitrateBps, 6_000_000);
  assert.equal(p1080.avcCodec, 'avc1.640028');

  const p1440 = PROGRAM_PROFILES['1440p'];
  assert.equal(p1440.label, '1440p QHD');
  assert.equal(p1440.width, 2560); assert.equal(p1440.height, 1440);
  assert.equal(p1440.fps, 30);
  assert.equal(p1440.masterBitrateBps, 20_000_000);
  assert.equal(p1440.streamBitrateBps, 6_000_000);
  assert.equal(p1440.avcCodec, 'avc1.640032');

  const p2160 = PROGRAM_PROFILES['2160p'];
  assert.equal(p2160.label, '2160p 4K UHD');
  assert.equal(p2160.width, 3840); assert.equal(p2160.height, 2160);
  assert.equal(p2160.fps, 30);
  assert.equal(p2160.masterBitrateBps, 40_000_000);
  assert.equal(p2160.streamBitrateBps, 6_000_000);
  assert.equal(p2160.avcCodec, 'avc1.640033');
});

test('la salida de streaming se capa siempre a 1080p', () => {
  for (const id of PROGRAM_PROFILE_IDS) {
    const p = PROGRAM_PROFILES[id];
    assert.ok(p.streamWidth <= 1920, `${id}: streamWidth supera 1920`);
    assert.ok(p.streamHeight <= 1080, `${id}: streamHeight supera 1080`);
    assert.equal(p.streamWidth, 1920);
    assert.equal(p.streamHeight, 1080);
  }
});

test('getProgramProfile: fallback al default si el id no existe', () => {
  assert.equal(getProgramProfile('1440p').id, '1440p');
  assert.equal(getProgramProfile('no-existe').id, '1080p');
  assert.equal(getProgramProfile(undefined).id, '1080p');
  assert.equal(getProgramProfile(null).id, '1080p');
  assert.equal(getProgramProfile().id, DEFAULT_PROGRAM_PROFILE_ID);
});

test('isUplinkCapped: true solo cuando el máster supera la salida', () => {
  assert.equal(isUplinkCapped(PROGRAM_PROFILES['1080p']), false);
  assert.equal(isUplinkCapped(PROGRAM_PROFILES['1440p']), true);
  assert.equal(isUplinkCapped(PROGRAM_PROFILES['2160p']), true);
  assert.equal(isUplinkCapped(null), false);
  assert.equal(isUplinkCapped(undefined), false);
});
