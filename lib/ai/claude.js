const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

export async function callClaude({ prompt, systemPrompt = '', apiKey }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const body = {
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  }
  if (systemPrompt) body.system = systemPrompt

  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Claude API error ${res.status}${err ? `: ${err.slice(0, 120)}` : ''}`)
  }

  const data = await res.json()
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('')
}
