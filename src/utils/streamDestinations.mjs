const DEFAULT_SERVERS = {
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
  youtube: 'rtmp://a.rtmp.youtube.com/live2/',
  tiktok: 'rtmp://live.tiktok.com/live/',
  custom: 'rtmp://live.twitch.tv/app/',
};

export function buildStreamDestinations(streamConfigs) {
  return Object.entries(streamConfigs || {})
    .filter(([, config]) => config?.enabled && String(config.key || config.server || '').trim())
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

      // Para destinos oficiales (Facebook, YouTube, TikTok), si el servidor fue borrado o no es rtmp, usar siempre el oficial
      if (DEFAULT_SERVERS[id]) {
        if (!server || !/^rtmps?:\/\//i.test(server)) {
          server = DEFAULT_SERVERS[id];
        }
      }

      // Validación para custom
      if (!/^rtmps?:\/\//i.test(server)) {
        if (DEFAULT_SERVERS[id]) {
          server = DEFAULT_SERVERS[id];
        } else {
          throw new Error(`El servidor de ${id} debe comenzar con rtmp:// o rtmps://.`);
        }
      }

      const normalizedServer = server.replace(/\/+$/, '');
      const streamKey = key.replace(/\s+/g, '').replace(/^\/+|\/+$/g, '');

      if (!streamKey && (!normalizedServer.includes('/') || normalizedServer.endsWith('.com'))) {
        throw new Error(`Por favor ingresa la Clave de Transmisión (Stream Key) de ${id === 'facebook' ? 'Facebook Live' : id}.`);
      }

      const publishUrl = streamKey
        ? `${normalizedServer}/${streamKey}`
        : normalizedServer;

      return {
        id,
        name: id === 'facebook' ? 'Facebook Live' : id === 'youtube' ? 'YouTube Live' : id === 'tiktok' ? 'TikTok Live' : 'RTMP Personalizado',
        url: publishUrl,
      };
    });
}
