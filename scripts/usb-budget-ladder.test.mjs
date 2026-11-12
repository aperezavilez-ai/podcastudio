// Escalera USB extendida (v3.0.0): perfiles 1440p/2160p y presupuesto
// en equivalentes 1080p (2160p=2, 1440p=1.5, 1080p=1, 720p o menos=0).
// Complementa —sin tocar— la suite histórica usb-budget.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USB_OPEN_TIERS,
  decideUsbOpenTier,
  nextUsbTierDown,
} from '../src/utils/usbBudget.mjs';

test('una 2160p viva agota el presupuesto: la siguiente apertura pedida a 1080p cae a 720p', () => {
  const live = [{ width: 3840, height: 2160 }];
  assert.equal(decideUsbOpenTier(live, '1080p'), '720p');
  assert.equal(decideUsbOpenTier(live), '720p');
});

test('pedir 2160p sin cámaras vivas lo concede', () => {
  assert.equal(decideUsbOpenTier([], '2160p'), '2160p');
});

test('pedir 2160p con una 1080p viva cae a 1080p', () => {
  const live = [{ width: 1920, height: 1080 }];
  assert.equal(decideUsbOpenTier(live, '2160p'), '1080p');
});

test('cadena completa de nextUsbTierDown', () => {
  assert.equal(nextUsbTierDown('2160p'), '1440p');
  assert.equal(nextUsbTierDown('1440p'), '1080p');
  assert.equal(nextUsbTierDown('1080p'), '720p');
  assert.equal(nextUsbTierDown('720p'), '480p');
  assert.equal(nextUsbTierDown('480p'), '480p');
});

test('los escalones nuevos tienen el patrón de constraints de 1080p', () => {
  assert.equal(USB_OPEN_TIERS['1440p'].width.ideal, 2560);
  assert.equal(USB_OPEN_TIERS['1440p'].width.min, 1280);
  assert.equal(USB_OPEN_TIERS['1440p'].height.ideal, 1440);
  assert.equal(USB_OPEN_TIERS['1440p'].height.min, 720);
  assert.equal(USB_OPEN_TIERS['1440p'].frameRate.ideal, 30);
  assert.equal(USB_OPEN_TIERS['1440p'].frameRate.min, 15);
  assert.equal(USB_OPEN_TIERS['2160p'].width.ideal, 3840);
  assert.equal(USB_OPEN_TIERS['2160p'].width.min, 1920);
  assert.equal(USB_OPEN_TIERS['2160p'].height.ideal, 2160);
  assert.equal(USB_OPEN_TIERS['2160p'].height.min, 1080);
  assert.equal(USB_OPEN_TIERS['2160p'].frameRate.ideal, 30);
  assert.equal(USB_OPEN_TIERS['2160p'].frameRate.min, 15);
});

test('el default sigue dando 1080p/720p como en la suite histórica', () => {
  assert.equal(decideUsbOpenTier([]), '1080p');
  assert.equal(decideUsbOpenTier([{ width: 1920, height: 1080 }]), '1080p');
  assert.equal(decideUsbOpenTier([{ width: 1280, height: 720 }]), '1080p');
  const dos = [{ width: 1920, height: 1080 }, { width: 1920, height: 1080 }];
  assert.equal(decideUsbOpenTier(dos), '720p');
  assert.equal(decideUsbOpenTier(dos.slice(1)), '1080p');
});

test('720p se concede siempre (válvula de alivio)', () => {
  const live = [{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }];
  assert.equal(decideUsbOpenTier(live, '720p'), '720p');
  assert.equal(decideUsbOpenTier(live, '2160p'), '720p');
});

test('una 1440p viva deja hueco solo para otra apertura menor', () => {
  const live = [{ width: 2560, height: 1440 }];
  // Restan 0.5 equivalentes: 1440p (1.5) y 1080p (1) no caben; 720p sí.
  assert.equal(decideUsbOpenTier(live, '1440p'), '720p');
  assert.equal(decideUsbOpenTier(live, '1080p'), '720p');
});
