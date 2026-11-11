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

const DEFAULT_CONFIGURED_TTL_MS = 5 * 60 * 1000;
const CACHE_REFRESH_MARGIN_MS = 60 * 1000;

export function getIceServers() {
  return STUN_SERVERS.map((server) => ({ ...server }));
}

// Acepta los servidores tal cual vengan del proveedor (STUN sin
// username/credential, TURN de Cloudflare o de coturn) y los fusiona con
// los STUN públicos de respaldo sin duplicar ninguna URL.
function mergeIceServers(serverList) {
  const seenUrls = new Set();
  const merged = [];
  const candidates = [
    ...(Array.isArray(serverList) ? serverList : []),
    ...STUN_SERVERS,
  ];
  for (const server of candidates) {
    if (!server) continue;
    const rawUrls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const urls = rawUrls.filter((url) => typeof url === 'string' && url && !seenUrls.has(url));
    if (!urls.length) continue;
    urls.forEach((url) => seenUrls.add(url));
    merged.push({ ...server, urls: Array.isArray(server.urls) ? urls : urls[0] });
  }
  return merged.length ? merged : getIceServers();
}

function resolveExpiresAtMs(data) {
  const raw = Number(data?.expiresAt || 0);
  if (!raw || !Number.isFinite(raw)) return Date.now() + DEFAULT_CONFIGURED_TTL_MS;
  // El endpoint devuelve segundos; si ya viniera en ms se respeta.
  return raw > 1e12 ? raw : raw * 1000;
}

export async function getConfiguredIceServers() {
  if (configuredServersCache && configuredServersCache.expiresAt > Date.now() + CACHE_REFRESH_MARGIN_MS) {
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
        // El servidor emite TURN de Cloudflare con o sin sesión (TTL corto
        // para invitados) y coturn solo con sesión. Las cámaras invitadas
        // no tienen cuenta, por eso el token es opcional y cualquier fallo
        // se ignora cayendo a los STUN de respaldo.
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
        // Respuesta normalizada venga del proveedor que venga: se acepta
        // { iceServers: [...] } tal cual (ya no se descartan los STUN ni
        // ningún servidor sin username/credential). mergeIceServers
        // garantiza que la lista nunca quede vacía.
        const remoteServers = Array.isArray(data?.iceServers)
          ? data.iceServers
          : data?.iceServers
            ? [data.iceServers]
            : [];
        return {
          iceServers: mergeIceServers(remoteServers),
          expiresAt: resolveExpiresAtMs(data),
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