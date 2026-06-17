import { useState, useCallback } from 'react'

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

async function callClaude(prompt, systemPrompt = '') {
  const messages = [{ role: 'user', content: prompt }]
  const body = { model: MODEL, max_tokens: 1500, messages }
  if (systemPrompt) body.system = systemPrompt
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = await res.json()
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('')
}

export function useAI() {
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingCintillo, setLoadingCintillo] = useState(false)
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')

  const generateCintillo = useCallback(async ({ topic, guest, role, type }) => {
    setLoadingCintillo(true)
    setError('')
    try {
      const prompt = `Genera un cintillo de ${type === 'guest' ? 'presentación del invitado' : 'tema'} para un podcast en español latinoamericano.
Invitado: ${guest || 'N/A'}, Cargo: ${role || 'N/A'}, Tema: ${topic || 'N/A'}
Tipo: ${type}
Responde SOLO el texto del cintillo, máximo 60 caracteres, sin comillas ni explicaciones.`
      const text = await callClaude(prompt)
      return text.trim().slice(0, 80)
    } catch (e) {
      setError('Error al generar cintillo')
      return null
    } finally {
      setLoadingCintillo(false)
    }
  }, [])

  const generatePosts = useCallback(async ({ podcast, topic, guest, role, description, platforms }) => {
    setLoadingPosts(true)
    setPosts(null)
    setError('')
    try {
      const platList = platforms.join(', ')
      const prompt = `Eres experto en marketing de podcasts en español para Latinoamérica.

Podcast: ${podcast}
Tema del episodio: ${topic}
Invitado: ${guest} ${role ? `— ${role}` : ''}
Descripción: ${description || 'Nuevo episodio disponible'}
Plataformas: ${platList}

Para cada plataforma genera:
- Texto del post adaptado (Instagram: emotivo, TikTok: hook viral, Facebook: conversacional, YouTube: SEO)  
- 10-15 hashtags virales mezclando grandes (#podcast) con nicho (#IAenLatam)

Responde SOLO JSON válido sin backticks:
{
  "instagram": {"post": "...", "hashtags": ["#tag"]},
  "tiktok": {"post": "...", "hashtags": ["#tag"]},
  "facebook": {"post": "...", "hashtags": ["#tag"]},
  "youtube": {"post": "...", "hashtags": ["#tag"]}
}
Incluye SOLO las plataformas: ${platList}`

      const raw = await callClaude(prompt)
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setPosts(parsed)
      return parsed
    } catch (e) {
      setError('Error al generar posts. Verifica tu conexión y vuelve a intentar.')
      return null
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  return { generateCintillo, generatePosts, loadingPosts, loadingCintillo, posts, setPosts, error }
}
