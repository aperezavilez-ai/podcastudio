export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const configured = !!process.env.ANTHROPIC_API_KEY
  res.status(200).json({
    configured,
    provider: 'claude',
    model: 'claude-sonnet-4-6',
  })
}
