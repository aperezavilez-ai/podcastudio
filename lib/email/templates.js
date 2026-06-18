const SITE = () => process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://podcaststudio.mx'

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a10;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a10;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#12121a;border-radius:12px;border:1px solid #2a2a38;overflow:hidden;">
        <tr><td style="padding:28px 32px 16px;text-align:center;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#e8612a,#9d8ce8);line-height:40px;font-size:20px;">🎙</div>
          <h1 style="margin:12px 0 0;color:#f4f4f8;font-size:22px;font-weight:700;">PodcastStudio</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;color:#c8c8d4;font-size:15px;line-height:1.65;">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#0b0b12;border-top:1px solid #2a2a38;color:#666;font-size:11px;text-align:center;">
          PodcastStudio · <a href="${SITE()}" style="color:#9d8ce8;">${SITE().replace(/^https?:\/\//, '')}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function btn(label, href) {
  return `<p style="margin:24px 0 8px;text-align:center;">
    <a href="${href}" style="display:inline-block;padding:12px 28px;background:#e8612a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>
  </p>`
}

export const EMAIL_TEMPLATES = {
  welcome({ name }) {
    const n = name || 'Podcaster'
    return {
      subject: `¡Bienvenido a PodcastStudio, ${n}!`,
      html: layout('Bienvenida', `
        <p>Hola <strong style="color:#fff;">${n}</strong>,</p>
        <p>Tu cuenta está lista. Ya puedes configurar tu podcast, grabar episodios con cámaras múltiples, cintillos y teleprompter.</p>
        ${btn('Ir al estudio', `${SITE()}/setup`)}
        <p style="font-size:13px;color:#888;">Consejo: conecta 2–3 cámaras USB y activa el Director IA para cortes automáticos.</p>
      `),
    }
  },

  project_ready({ name, podcastName, episodeTitle }) {
    const n = name || 'Podcaster'
    return {
      subject: `Tu estudio «${podcastName || 'Mi Podcast'}» está listo`,
      html: layout('Proyecto listo', `
        <p>Hola <strong style="color:#fff;">${n}</strong>,</p>
        <p>Configuraste tu proyecto <strong style="color:#fff;">${podcastName || 'Mi Podcast'}</strong>${episodeTitle ? ` — episodio: <em>${episodeTitle}</em>` : ''}.</p>
        <p>Logo, fondos y cintillos ya están guardados. ¡Es hora de grabar!</p>
        ${btn('Abrir estudio', `${SITE()}/studio`)}
      `),
    }
  },

  recording_ready({ name, podcastName, episodeTitle, duration, fileName }) {
    const n = name || 'Podcaster'
    const dur = duration || '—'
    return {
      subject: `Grabación lista — ${podcastName || 'Mi Podcast'}`,
      html: layout('Grabación lista', `
        <p>Hola <strong style="color:#fff;">${n}</strong>,</p>
        <p>Terminaste una grabación en <strong style="color:#fff;">${podcastName || 'Mi Podcast'}</strong>${episodeTitle ? ` (${episodeTitle})` : ''}.</p>
        <table style="width:100%;margin:16px 0;background:#1a1a24;border-radius:8px;border:1px solid #2a2a38;">
          <tr><td style="padding:12px 16px;color:#888;font-size:13px;">Duración</td><td style="padding:12px 16px;color:#fff;font-size:13px;text-align:right;">${dur}</td></tr>
          <tr><td style="padding:12px 16px;color:#888;font-size:13px;">Archivo</td><td style="padding:12px 16px;color:#fff;font-size:13px;text-align:right;">${fileName || 'episodio'}</td></tr>
        </table>
        <p>Descarga el video desde la pestaña <strong>Grabaciones</strong> en el estudio.</p>
        ${btn('Ver grabaciones', `${SITE()}/studio`)}
      `),
    }
  },

  live_started({ name, podcastName, platforms }) {
    const n = name || 'Podcaster'
    const plats = (platforms || []).join(', ') || 'YouTube, Facebook'
    return {
      subject: `🔴 En vivo — ${podcastName || 'Mi Podcast'}`,
      html: layout('Transmisión en vivo', `
        <p>Hola <strong style="color:#fff;">${n}</strong>,</p>
        <p>Iniciaste una transmisión en vivo de <strong style="color:#fff;">${podcastName || 'Mi Podcast'}</strong>.</p>
        <p style="color:#4ade80;">Plataformas: ${plats}</p>
        <p style="font-size:13px;color:#888;">Recuerda usar OBS con la clave RTMP del panel de transmisión.</p>
        ${btn('Volver al estudio', `${SITE()}/studio`)}
      `),
    }
  },
}

export function buildEmail(type, data = {}) {
  const fn = EMAIL_TEMPLATES[type]
  if (!fn) throw new Error(`Tipo de email desconocido: ${type}`)
  return fn(data)
}
