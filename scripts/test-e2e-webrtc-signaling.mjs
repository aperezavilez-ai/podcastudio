import { createClient } from '@supabase/supabase-js';

const url = 'https://fzoiuyyvzhgqcjceagkd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2l1eXl2emhncWNqY2VhZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMyOTUsImV4cCI6MjA5NzMwOTI5NX0.YQpOkEmgWHOTJgUnHp-EfWt68QW9xWTUxbvjzUtfU54';

console.log('Testing Supabase Realtime Broadcast Signaling...');

const clientStudio = createClient(url, key);
const clientPhone = createClient(url, key);

const testRoom = `studio_cam_test_${Date.now()}`;
const channelName = `remotecam_${testRoom}`;

console.log(`Connecting to channel: ${channelName}`);

const studioChannel = clientStudio.channel(channelName, { config: { broadcast: { self: false } } });
const phoneChannel = clientPhone.channel(channelName, { config: { broadcast: { self: false } } });

let studioReceivedOffer = false;
let phoneReceivedAnswer = false;

studioChannel.on('broadcast', { event: 'signal' }, async (event) => {
  const payload = event?.payload;
  console.log('[Studio received]', payload?.type, 'from', payload?.sender);
  if (payload?.type === 'offer') {
    studioReceivedOffer = true;
    console.log('[Studio] Sending answer...');
    await studioChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type: 'answer', sdp: { type: 'answer', sdp: 'v=0...' }, connectionId: payload.connectionId, sender: 'studio' },
    });
  }
});

phoneChannel.on('broadcast', { event: 'signal' }, async (event) => {
  const payload = event?.payload;
  console.log('[Phone received]', payload?.type, 'from', payload?.sender);
  if (payload?.type === 'answer') {
    phoneReceivedAnswer = true;
    console.log('SUCCESS: Full signaling handshake completed!');
    process.exit(0);
  }
});

const sub1 = new Promise((resolve) => {
  studioChannel.subscribe((status) => {
    console.log(`Studio sub status: ${status}`);
    if (status === 'SUBSCRIBED') resolve();
  });
});

const sub2 = new Promise((resolve) => {
  phoneChannel.subscribe((status) => {
    console.log(`Phone sub status: ${status}`);
    if (status === 'SUBSCRIBED') resolve();
  });
});

await Promise.all([sub1, sub2]);
console.log('Both subscribed! Phone sending offer...');

await phoneChannel.send({
  type: 'broadcast',
  event: 'signal',
  payload: {
    type: 'offer',
    sdp: { type: 'offer', sdp: 'v=0...' },
    connectionId: 'conn_test_123',
    connectionStartedAt: Date.now(),
    sender: 'phone',
    slot: '2',
  },
});

setTimeout(() => {
  console.error('TIMED OUT: Handshake did not complete in 10s');
  console.error({ studioReceivedOffer, phoneReceivedAnswer });
  process.exit(1);
}, 10000);
