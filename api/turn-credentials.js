const TURN_CREDENTIAL_TTL_SECONDS = 12 * 60 * 60

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Vary', 'Origin')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const turnKeyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN
  if (!turnKeyId || !apiToken) {
    return res.status(503).json({ error: 'Managed TURN is not configured' })
  }

  let upstream
  try {
    upstream = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
      }
    )
  } catch {
    return res.status(502).json({ error: 'Managed TURN credential service is unavailable' })
  }

  if (!upstream.ok) {
    return res.status(502).json({ error: 'Managed TURN credential service rejected the request' })
  }

  let credentials
  try {
    credentials = await upstream.json()
  } catch {
    return res.status(502).json({ error: 'Managed TURN returned an invalid response' })
  }

  const iceServers = Array.isArray(credentials.iceServers)
    ? credentials.iceServers.map((server) => {
      if (!server || typeof server.username !== 'string' || typeof server.credential !== 'string') return null
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
      const browserUrls = urls.filter((url) => typeof url === 'string' && !/:(53)(?:\?|$)/.test(url))
      if (!browserUrls.length) return null
      return { ...server, urls: Array.isArray(server.urls) ? browserUrls : browserUrls[0] }
    }).filter((server) =>
      server && typeof server.username === 'string' && typeof server.credential === 'string' &&
      (typeof server.urls === 'string' || Array.isArray(server.urls))
    )
    : []
  if (!iceServers.length) {
    return res.status(502).json({ error: 'Managed TURN returned no usable ICE servers' })
  }

  return res.status(200).json({
    iceServers,
    expiresAt: Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS,
  })
}
