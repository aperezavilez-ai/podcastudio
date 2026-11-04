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

/**
 * Obtiene servidores ICE con fallback automático.
 * En producción: intenta obtener credenciales TURN del servidor con timeout.
 * En desarrollo/Electron: usa STUN de alta velocidad directamente.
 */
export function getIceServers() {
  return STUN_SERVERS.map((server) => ({ ...server }));
}

/** Fetch short-lived TURN credentials from the server; never ship a shared secret to browsers. */
export async function getConfiguredIceServers() {
  // Cache válido por 1 hora, refrescar 30s antes de expirar
  if (configuredServersCache && configuredServersCache.expiresAt > Date.now() + 30000) {
    return configuredServersCache.iceServers;
  }
  if (!configuredServersPromise) {
    // En Electron (file://), evitar peticiones de red fallidas relativas
    const isFileProto = typeof window !== 'undefined' && window.location?.protocol === 'file:';
    if (isFileProto) {
      configuredServersCache = {
        iceServers: getIceServers(),
        expiresAt: Date.now() + 3600000,
      };
      return configuredServersCache.iceServers;
    }

    configuredServersPromise = fetch('/api/turn-credentials', { 
      cache: 'no-store',
      // Timeout de 5 segundos para evitar bloqueos en redes lentas
      signal: AbortSignal.timeout(5000),
    })
      .then(async (response) => {
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
      })
      .catch(() => null)
      .then((cache) => {
        configuredServersCache = cache || {
          iceServers: getIceServers(),
          expiresAt: Date.now() + 60000, // 1 min en caso de error para reintento rápido
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
