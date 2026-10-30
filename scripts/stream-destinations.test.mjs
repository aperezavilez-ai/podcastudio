import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStreamDestinations } from '../src/utils/streamDestinations.mjs';

test('normalizes Facebook RTMPS server and appends the key exactly once', () => {
  const targets = buildStreamDestinations({
    facebook: { enabled: true, server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: 'FAKE_TEST_STREAM_KEY_123' },
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].url, 'rtmps://live-api-s.facebook.com:443/rtmp/FAKE_TEST_STREAM_KEY_123');
});

test('accepts a complete RTMPS publish URL pasted into the key field', () => {
  const targets = buildStreamDestinations({
    facebook: { enabled: true, server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: 'rtmps://live-api-s.facebook.com:443/rtmp/FAKE_TEST_STREAM_KEY_123' },
  });
  assert.equal(targets[0].url, 'rtmps://live-api-s.facebook.com:443/rtmp/FAKE_TEST_STREAM_KEY_123');
});

test('treats a stream key as an opaque URL path segment', () => {
  const targets = buildStreamDestinations({
    facebook: { enabled: true, server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: 'FAKE_KEY+WITH?RESERVED#CHARS' },
  });
  assert.equal(targets[0].url, 'rtmps://live-api-s.facebook.com:443/rtmp/FAKE_KEY%2BWITH%3FRESERVED%23CHARS');
});

test('does not start disabled destinations or destinations without a key', () => {
  assert.deepEqual(buildStreamDestinations({
    facebook: { enabled: true, server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: '' },
    youtube: { enabled: false, server: 'rtmp://a.rtmp.youtube.com/live2/', key: 'FAKE_TEST_STREAM_KEY_123' },
  }), []);
});

test('rejects non-RTMP server URLs without exposing the supplied key', () => {
  assert.throws(() => buildStreamDestinations({
    facebook: { enabled: true, server: 'https://example.com/live', key: 'FAKE_TEST_STREAM_KEY_123' },
  }), /rtmp:\/\/ o rtmps:\/\//);
});
