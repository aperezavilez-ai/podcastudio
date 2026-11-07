const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

let configuredServersPromise = null;
let configuredServersCache = null;

export function getIceServers() {
  return STUN_SERVERS.map((server) => ({ ...server }));
}

export async function getConfiguredIceServers() {
  if (configuredServersCache && configuredServersCache.expiresAt > Date.now() + 30000) {
    return configuredServersCache.iceServers;
  }
  if (!configuredServersPromise) {
    configuredServersPromise = (async () => {
      const isFileProto = typeof window !== 'undefined' && window.location?.protocol === 'file:';
      if (isFileProto) {
        const fallbackTurnServers = [
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ];
        configuredServersCache = {
          iceServers: [...STUN_SERVERS.map((s) => ({ ...s })), ...fallbackTurnServers],
          expiresAt: Date.now() + 3600000,
        };
        return configuredServersCache.iceServers;
      }

      try {
        // El servidor solo emite credenciales TURN con sesión de Supabase;
        // sin sesión devuelve solo STUN. Las cámaras invitadas no tienen
        // cuenta, por eso el token es opcional y cualquier fallo se ignora.
        let authHeaders = {};
        try {
          const { supabase } = await import('../lib/supabase.js');
          const { data } = await supabase.auth.getSession();
          const token = data?.session?.access_token;
          if (token) authHeaders = { Authorization: `Bearer ${token}` };
        } catch {}
        const response = await fetch('/api/turn-credentials', {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
          headers: authHeaders,
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!Array.isArray(data.iceServers)) return null;
        const turnServers = data.iceServers.filter((server) =>
          server && typeof server.username === 'string' && typeof server.credential === 'string' &&
          (typeof server.urls === 'string' || Array.isArray(server.urls))
        );
        if (!turnServers.length) return null;
        return {
          iceServers: [...STUN_SERVERS.map((s) => ({ ...s })), ...turnServers],
          expiresAt: Number(data.expiresAt || 0) * 1000,
        };
      } catch {
        return null;
      }
    })()
    .then((cache) => {
      configuredServersCache = cache || {
        iceServers: getIceServers(),
        expiresAt: Date.now() + 60000,
      };
      return configuredServersCache.iceServers;
    })
    .finally(() => { configuredServersPromise = null; });
  }
  return configuredServersPromise;
}

export function getWebRtcConfig() {
  return {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 4,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
  };
}

export async function getConfiguredWebRtcConfig() {
  return { ...getWebRtcConfig(), iceServers: await getConfiguredIceServers() };
}

export const RTC_CONFIG = getWebRtcConfig();