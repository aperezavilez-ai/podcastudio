// Ruteado via GafCore API Proxy (pool-cheap: Groq -> Cerebras -> GPTPRO4ALL
// con fallback automatico) en vez de llamar directo a Anthropic.
const PROXY_API = 'https://gafcore-api-proxy.vercel.app/api/proxy/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

export async function callClaude({ prompt, systemPrompt = '', projectKey }) {
  if (!projectKey) throw new Error('GAFCORE_PROXY_PROJECT_KEY no configurada')

  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const body = {
    model: MODEL,
    max_tokens: 1500,
    messages,
  }

  const res = await fetch(PROXY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-project-key': projectKey,
      'x-provider-id': 'pool-cheap',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Proxy error ${res.status}${err ? `: ${err.slice(0, 120)}` : ''}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}
