import { getUserFromAuthHeader } from '../../../lib/supabase/auth.js'
import { listUserRecordings } from '../../../lib/integrations/recordings.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  try {
    const recordings = await listUserRecordings(user.id)
    res.status(200).json({ recordings })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
