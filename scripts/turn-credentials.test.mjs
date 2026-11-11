import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTurnCredentials } from '../api/turn-credentials.js';

const CLOUDFLARE_ENV = {
  CLOUDFLARE_TURN_TOKEN_ID: 'test-token-id',
  CLOUDFLARE_TURN_API_TOKEN: 'test-api-token',
};

function makeReqRes({ authorization } = {}) {
  const req = {
    method: 'GET',
    headers: authorization ? { authorization } : {},
    socket: { remoteAddress: '203.0.113.10' },
  };
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

function allowAllRateLimit(counter) {
  return () => {
    if (counter) counter.calls += 1;
    return true;
  };
}

function assertStunOnly(res) {
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.iceServers));
  assert.ok(res.body.iceServers.length > 0);
  for (const server of res.body.iceServers) {
    assert.ok(String(server.urls).startsWith('stun:'), `expected STUN only, got ${server.urls}`);
    assert.equal(server.username, undefined);
    assert.equal(server.credential, undefined);
  }
  assert.ok(Number.isFinite(res.body.expiresAt));
}

test('Cloudflare OK con sesión → iceServers normalizados y ttl 86400 pedido', async () => {
  const { req, res } = makeReqRes({ authorization: 'Bearer session-token' });
  const fetchCalls = [];
  const fetchFn = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        iceServers: {
          urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
          username: 'cf-user',
          credential: 'cf-credential',
        },
      }),
    };
  };

  const before = Math.floor(Date.now() / 1000);
  await handleTurnCredentials(req, res, {
    env: { ...CLOUDFLARE_ENV },
    fetchFn,
    getUserFromAuthHeader: async () => ({ id: 'user-1' }),
    applyRateLimit: allowAllRateLimit(),
  });
  const after = Math.floor(Date.now() / 1000);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.iceServers, [
    {
      urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
      username: 'cf-user',
      credential: 'cf-credential',
    },
  ]);
  assert.ok(res.body.expiresAt >= before + 86400 && res.body.expiresAt <= after + 86400);

  assert.equal(fetchCalls.length, 1);
  assert.equal(
    fetchCalls[0].url,
    'https://rtc.live.cloudflare.com/v1/turn/keys/test-token-id/credentials/generate',
  );
  assert.equal(fetchCalls[0].options.method, 'POST');
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer test-api-token');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { ttl: 86400 });
});

test('invitado sin sesión → ttl 3600 y rate limit aplicado también a invitados', async () => {
  const { req, res } = makeReqRes();
  const fetchCalls = [];
  const rateLimitCounter = { calls: 0 };
  const fetchFn = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        iceServers: { urls: 'turn:turn.cloudflare.com:3478?transport=udp', username: 'guest-user', credential: 'guest-credential' },
      }),
    };
  };

  await handleTurnCredentials(req, res, {
    env: { ...CLOUDFLARE_ENV },
    fetchFn,
    getUserFromAuthHeader: async () => null,
    applyRateLimit: allowAllRateLimit(rateLimitCounter),
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.iceServers, [
    { urls: 'turn:turn.cloudflare.com:3478?transport=udp', username: 'guest-user', credential: 'guest-credential' },
  ]);
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { ttl: 3600 });
  assert.equal(rateLimitCounter.calls, 1);
});

test('Cloudflare caído (fetch rechaza) y sin vars coturn → STUN-only, sin 500', async () => {
  const { req, res } = makeReqRes();
  const fetchFn = async () => {
    throw new Error('network down');
  };

  await handleTurnCredentials(req, res, {
    env: { ...CLOUDFLARE_ENV },
    fetchFn,
    getUserFromAuthHeader: async () => null,
    applyRateLimit: allowAllRateLimit(),
  });

  assertStunOnly(res);
});

test('sin vars Cloudflare ni coturn → STUN-only y fetch no se llama', async () => {
  const { req, res } = makeReqRes({ authorization: 'Bearer session-token' });
  let fetchCalled = false;
  const fetchFn = async () => {
    fetchCalled = true;
    throw new Error('must not be called');
  };

  await handleTurnCredentials(req, res, {
    env: {},
    fetchFn,
    getUserFromAuthHeader: async () => ({ id: 'user-1' }),
    applyRateLimit: allowAllRateLimit(),
  });

  assertStunOnly(res);
  assert.equal(fetchCalled, false);
});
