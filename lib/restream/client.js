const RESTREAM_API = 'https://api.restream.io/v2'

export function isRestreamConfigured() {
  return !!process.env.RESTREAM_API_TOKEN
}

async function restreamFetch(path) {
  const token = process.env.RESTREAM_API_TOKEN
  if (!token) throw new Error('Restream no configurado')

  const res = await fetch(`${RESTREAM_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Restream API ${res.status}`)
  }

  return res.json()
}

export async function getRestreamIngest() {
  const data = await restreamFetch('/user/channel')
  const streamKey = data?.streamKey || data?.stream_key || data?.key
  if (!streamKey) throw new Error('No se pudo obtener la stream key de Restream')

  return {
    rtmpUrl: 'rtmp://live.restream.io/live',
    streamKey,
    fullRtmpUrl: `rtmp://live.restream.io/live/${streamKey}`,
  }
}

export async function getRestreamChannels() {
  try {
    const data = await restreamFetch('/user/channels')
    const list = Array.isArray(data) ? data : data?.channels || data?.data || []
    return list.map((ch) => ({
      id: ch.id || ch.channelId,
      platform: ch.platform || ch.type || ch.name,
      name: ch.name || ch.title || ch.platform,
      enabled: ch.enabled !== false,
    }))
  } catch {
    return []
  }
}
