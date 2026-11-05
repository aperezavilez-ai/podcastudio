const DEFAULT_SERVERS = {
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
  youtube: 'rtmp://a.rtmp.youtube.com/live2/',
  tiktok: 'rtmp://live.tiktok.com/live/',
  custom: 'rtmp://live.twitch.tv/app/',
};

export function buildStreamDestinations(streamConfigs) {
  return Object.entries(streamConfigs || {})
    // A destination is actionable only with an explicit key.  Starting FFmpeg
    // against a bare ingest URL looks successful for a moment, but can never
    // publish a program feed.
    .filter(([, config]) => config?.enabled && String(config.key || '').trim())
    .map(([id, config]) => {
      let server = String(config.server || DEFAULT_SERVERS[id] || '').trim();
      let key = String(config.key || '').trim();

      // Si el usuario pegó la URL completa con clave en el campo de clave (ej: rtmps://.../FB-1234)
      if (/^rtmps?:\/\//i.test(key)) {
        const lastSlash = key.lastIndexOf('/');
        if (lastSlash > 8) {
          server = key.substring(0, lastSlash + 1);
          key = key.substring(lastSlash + 1);
        } else {
          server = key;
          key = '';
        }
      }

      // Si el usuario pegó la clave de Facebook (FB-...) en el campo del servidor
      if (server.includes('FB-') && !key) {
        const match = server.match(/(FB-[A-Za-z0-9_-]+)/);
        if (match) {
          key = match[1];
          server = DEFAULT_SERVERS.facebook;
        }
      }

      // Never silently replace an invalid ingest URL: that hides a typo and
      // sends a live program to an unexpected endpoint.
      if (!/^rtmps?:\/\//i.test(server)) {
        if (!server) {
          server = DEFAULT_SERVERS[id];
        } else {
          throw new Error(`El servidor de ${id} debe comenzar con rtmp:// o rtmps://.`);
        }
      }

      const normalizedServer = server.replace(/\/+$/, '');
      const streamKey = key.replace(/\s+/g, '').replace(/^\/+|\/+$/g, '');

      const publishUrl = streamKey
        // A stream key is data, not URL syntax. Escaping keeps reserved
        // characters from changing the RTMP path or being treated as a query.
        ? `${normalizedServer}/${encodeURIComponent(streamKey)}`
        : normalizedServer;

      return {
        id,
        name: id === 'facebook' ? 'Facebook Live' : id === 'youtube' ? 'YouTube Live' : id === 'tiktok' ? 'TikTok Live' : 'RTMP Personalizado',
        url: publishUrl,
      };
    });
}
