// Raíz B (v2.0.0): presupuesto de bus USB por formato — decisión previa a
// la apertura, sin medir fps bajo carga y sin persistir rebajas (eso era
// la escalera de la v1.6.0, prohibida: fijó una cámara sana en 480p).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SIMULTANEOUS_1080P_USB,
  USB_OPEN_TIERS,
  decideUsbOpenTier,
  nextUsbTierDown,
} from '../src/utils/usbBudget.mjs';

test('sin cámaras vivas o con una sola a 1080p, la apertura es 1080p', () => {
  assert.equal(decideUsbOpenTier([]), '1080p');
  assert.equal(decideUsbOpenTier([{ width: 1920, height: 1080 }]), '1080p');
  assert.equal(decideUsbOpenTier([{ width: 1280, height: 720 }]), '1080p');
});

test('con el máximo de cámaras a 1080p ya vivas, la siguiente abre a 720p', () => {
  const live = Array.from({ length: MAX_SIMULTANEOUS_1080P_USB }, () => ({ width: 1920, height: 1080 }));
  assert.equal(decideUsbOpenTier(live), '720p');
  // Y sigue siendo 720p aunque además haya cámaras menores vivas.
  assert.equal(decideUsbOpenTier([...live, { width: 1280, height: 720 }]), '720p');
});

test('la decisión se recalcula en cada apertura: al liberarse una 1080p vuelve 1080p', () => {
  const dos = [{ width: 1920, height: 1080 }, { width: 1920, height: 1080 }];
  assert.equal(decideUsbOpenTier(dos), '720p');
  assert.equal(decideUsbOpenTier(dos.slice(1)), '1080p');
});

test('el reintento baja un solo escalón y nunca sube', () => {
  assert.equal(nextUsbTierDown('1080p'), '720p');
  assert.equal(nextUsbTierDown('720p'), '480p');
  assert.equal(nextUsbTierDown('480p'), '480p');
});

test('los escalones son los formatos esperados', () => {
  assert.equal(USB_OPEN_TIERS['1080p'].width.ideal, 1920);
  assert.equal(USB_OPEN_TIERS['1080p'].height.ideal, 1080);
  assert.equal(USB_OPEN_TIERS['720p'].width.ideal, 1280);
  assert.equal(USB_OPEN_TIERS['480p'].width.ideal, 854);
});
