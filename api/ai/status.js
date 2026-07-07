export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const configured = !!process.env.GAFCORE_PROXY_PROJECT_KEY
  res.status(200).json({
    configured,
    provider: 'gafcore-pool-cheap',
    model: 'llama-3.1-8b-instant',
  })
}
