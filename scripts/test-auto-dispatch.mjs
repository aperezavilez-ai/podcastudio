import { createClient } from '@supabase/supabase-js';

const url = 'https://fzoiuyyvzhgqcjceagkd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2l1eXl2emhncWNqY2VhZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMyOTUsImV4cCI6MjA5NzMwOTI5NX0.YQpOkEmgWHOTJgUnHp-EfWt68QW9xWTUxbvjzUtfU54';

console.log('Testing Auto-Dispatch...');

const clientStudio = createClient(url, key);
const clientPhone = createClient(url, key);

const dispatchStudio = clientStudio.channel('remotecam_auto_dispatch', { config: { broadcast: { self: false } } });
const dispatchPhone = clientPhone.channel('remotecam_auto_dispatch', { config: { broadcast: { self: false } } });

const testDeviceId = `phone_test_${Date.now()}`;

dispatchStudio.on('broadcast', { event: 'request-slot' }, async (ev) => {
  const { deviceId } = ev?.payload || {};
  console.log('[Studio received request-slot from]', deviceId);
  if (deviceId === testDeviceId) {
    console.log('[Studio sending assign-slot] slot 2 -> studio_cam_2');
    await dispatchStudio.send({
      type: 'broadcast',
      event: 'assign-slot',
      payload: {
        targetDeviceId: deviceId,
        slot: 2,
        room: 'studio_cam_2',
      },
    });
  }
});

dispatchPhone.on('broadcast', { event: 'assign-slot' }, (ev) => {
  const payload = ev?.payload;
  console.log('[Phone received assign-slot]', payload);
  if (payload?.targetDeviceId === testDeviceId) {
    console.log('SUCCESS: Auto-dispatch completed successfully!');
    process.exit(0);
  }
});

const sub1 = new Promise((resolve) => dispatchStudio.subscribe((s) => s === 'SUBSCRIBED' && resolve()));
const sub2 = new Promise((resolve) => dispatchPhone.subscribe((s) => s === 'SUBSCRIBED' && resolve()));

await Promise.all([sub1, sub2]);
console.log('Both subscribed to auto-dispatch! Phone requesting slot...');

await dispatchPhone.send({
  type: 'broadcast',
  event: 'request-slot',
  payload: { deviceId: testDeviceId },
});

setTimeout(() => {
  console.error('TIMED OUT: Auto-dispatch did not complete in 10s');
  process.exit(1);
}, 10000);
