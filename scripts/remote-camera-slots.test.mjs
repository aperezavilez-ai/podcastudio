import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemoteCameraUrl, findAvailableRemoteCameraSlot, MAX_REMOTE_CAMERA_SLOTS } from '../src/utils/remoteCameraSlots.mjs';

test('builds a distinct QR destination and Supabase room for CAM 1 through CAM 12', () => {
  const destinations = [];
  for (let slotIndex = 0; slotIndex < MAX_REMOTE_CAMERA_SLOTS; slotIndex += 1) {
    const url = new URL(buildRemoteCameraUrl({ slotIndex }));
    const cameraNumber = slotIndex + 1;
    assert.equal(url.origin, 'https://www.podcastudio.mx');
    assert.equal(url.pathname, '/remote-cam');
    assert.equal(url.searchParams.get('slot'), String(cameraNumber));
    assert.equal(url.searchParams.get('room'), `studio_cam_${cameraNumber}`);
    destinations.push(url.toString());
  }
  assert.equal(new Set(destinations).size, MAX_REMOTE_CAMERA_SLOTS);
});

test('assigns every active remote slot without collisions from 4 through 12 cameras', () => {
  for (let cameraCount = 4; cameraCount <= MAX_REMOTE_CAMERA_SLOTS; cameraCount += 1) {
    const streams = { 0: { localCamera: true } };
    const assignments = {};
    const assigned = [];

    for (let cameraNumber = 2; cameraNumber <= cameraCount; cameraNumber += 1) {
      const deviceId = `phone-${cameraNumber}`;
      const slot = findAvailableRemoteCameraSlot({
        slotsCount: cameraCount,
        streams,
        assignedSlots: assignments,
        localStreamActive: true,
        requestingDeviceId: deviceId,
      });

      assert.notEqual(slot, null, `CAM ${cameraNumber} should have a slot at capacity ${cameraCount}`);
      assert.equal(slot + 1, cameraNumber, `phone should route to CAM ${cameraNumber}`);
      assert.equal(assignments[slot], undefined, `CAM ${cameraNumber} must not collide`);
      assignments[slot] = deviceId;
      streams[slot] = { remoteCamera: true };
      assigned.push(slot);
    }

    assert.equal(new Set(assigned).size, cameraCount - 1);
    assert.equal(findAvailableRemoteCameraSlot({
      slotsCount: cameraCount,
      streams,
      assignedSlots: assignments,
      localStreamActive: true,
      requestingDeviceId: 'extra-phone',
    }), null, `capacity ${cameraCount} must report full instead of reusing CAM 2`);
  }
});

test('reuses the reserved slot when the same phone retries allocation', () => {
  assert.equal(findAvailableRemoteCameraSlot({
    slotsCount: 12,
    assignedSlots: { 11: 'phone-retry' },
    requestingDeviceId: 'phone-retry',
  }), 11);
});

test('does not allocate a slot outside the active camera count', () => {
  assert.equal(findAvailableRemoteCameraSlot({
    slotsCount: 4,
    streams: { 0: {}, 1: {}, 2: {}, 3: {} },
    localStreamActive: true,
  }), null);
});
