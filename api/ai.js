import { callClaude } from '../lib/ai/claude.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'IA no configurada. Añade ANTHROPIC_API_KEY en Vercel.' })
    return
  }

  const { prompt, systemPrompt } = req.body || {}
  if (!prompt) {
    res.status(400).json({ error: 'Falta el prompt' })
    return
  }

  try {
    const text = await callClaude({ prompt, systemPrompt, apiKey })
    res.status(200).json({ text })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error al llamar a Claude' })
  }
}
