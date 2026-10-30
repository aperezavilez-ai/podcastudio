const DEFAULT_SERVERS = {
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
  youtube: 'rtmp://a.rtmp.youtube.com/live2/',
  tiktok: 'rtmp://live.tiktok.com/live/',
};

export function buildStreamDestinations(streamConfigs) {
  return Object.entries(streamConfigs || {})
    .filter(([, config]) => config?.enabled && String(config.key || '').trim())
    .map(([id, config]) => {
      let server = String(config.server || DEFAULT_SERVERS[id] || '').trim();
      let key = String(config.key || '').trim();

      // Facebook/YouTube sometimes provide a complete RTMP(S) publish URL.
      if (/^rtmps?:\/\//i.test(key)) {
        server = key;
        key = '';
      }

      if (!server && DEFAULT_SERVERS[id]) server = DEFAULT_SERVERS[id];
      if (!/^rtmps?:\/\//i.test(server)) {
        throw new Error(`El servidor de ${id} debe comenzar con rtmp:// o rtmps://.`);
      }

      const normalizedServer = server.replace(/\/+$/, '');
      const streamKey = key.replace(/\s+/g, '').replace(/^\/+|\/+$/g, '');
      if (streamKey && streamKey.length < 8) {
        throw new Error(`La clave de transmisión de ${id} es demasiado corta.`);
      }
      let parsedUrl;
      try { parsedUrl = new URL(normalizedServer); }
      catch { throw new Error(`La URL del servidor RTMP de ${id} no es válida.`); }

      if (!['rtmp:', 'rtmps:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
        throw new Error(`La URL del servidor RTMP de ${id} no es válida.`);
      }
      if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
        throw new Error(`Falta la clave de transmisión de ${id}.`);
      }
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      if (!streamKey && (pathSegments.length < 2 || pathSegments.at(-1).length < 8)) {
        throw new Error(`Falta la clave de transmisión de ${id}.`);
      }

      // A stream key is an opaque path segment, not a URL. Escaping it prevents
      // characters such as # or ? from being parsed as a fragment/query and
      // avoids rejecting a valid RTMP server because of key contents.
      const publishUrl = streamKey
        ? `${normalizedServer}/${encodeURIComponent(streamKey)}`
        : normalizedServer;

      return {
        id,
        name: id === 'facebook' ? 'Facebook Live' : id === 'youtube' ? 'YouTube Live' : id === 'tiktok' ? 'TikTok Live' : 'RTMP Personalizado',
        url: publishUrl,
      };
    });
}
