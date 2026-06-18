import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import { createDirectUpload, isMuxConfigured } from '../../lib/mux/client.js'
import { getSiteUrl } from '../../lib/integrations/site.js'
import { createRecordingRow } from '../../lib/integrations/recordings.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isMuxConfigured()) {
    res.status(503).json({ error: 'Añade MUX_TOKEN_ID y MUX_TOKEN_SECRET en Vercel' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión para subir grabaciones' })
    return
  }

  const { title, fileName, durationSec } = req.body || {}

  try {
    const { uploadId, uploadUrl } = await createDirectUpload({
      userId: user.id,
      title: title || 'Episodio',
      corsOrigin: getSiteUrl(),
    })

    const row = await createRecordingRow({
      userId: user.id,
      title: title || 'Episodio',
      fileName,
      durationSec,
      muxUploadId: uploadId,
    })

    res.status(200).json({
      recordingId: row.id,
      uploadId,
      uploadUrl,
    })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error al crear subida Mux' })
  }
}
