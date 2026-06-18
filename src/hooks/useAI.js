import { useState, useCallback, useEffect } from 'react'

async function callAI(prompt, systemPrompt = '') {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemPrompt }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data.text
}

export function useAI() {
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingCintillo, setLoadingCintillo] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')
  const [aiConfigured, setAiConfigured] = useState(false)

  const checkAIStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status')
      const data = await res.json().catch(() => ({}))
      setAiConfigured(!!data.configured)
      return !!data.configured
    } catch {
      setAiConfigured(false)
      return false
    }
  }, [])

  useEffect(() => { checkAIStatus() }, [checkAIStatus])

  const generateCintillo = useCallback(async ({ topic, guest, role, type }) => {
    setLoadingCintillo(true)
    setError('')
    try {
      const prompt = `Genera un cintillo de ${type === 'guest' ? 'presentación del invitado' : 'tema'} para un podcast en español latinoamericano.
Invitado: ${guest || 'N/A'}, Cargo: ${role || 'N/A'}, Tema: ${topic || 'N/A'}
Tipo: ${type}
Responde SOLO el texto del cintillo, máximo 60 caracteres, sin comillas ni explicaciones.`
      const text = await callAI(prompt)
      return text.trim().slice(0, 80)
    } catch (e) {
      setError(e.message || 'Error al generar cintillo')
      return null
    } finally {
      setLoadingCintillo(false)
    }
  }, [])

  const formatTeleprompterDocument = useCallback(async (rawText, { podcast, topic, guest } = {}) => {
    setLoadingScript(true)
    setError('')
    try {
      const prompt = `Eres editor profesional de guiones para teleprompter de podcasts en español latinoamericano.

Texto extraído de un documento Word:
---
${rawText.slice(0, 14000)}
---

Tu trabajo:
1. Corrige ortografía, gramática y puntuación
2. Adapta el texto para lectura en voz alta frente a cámara (tono natural y conversacional)
3. Divide en párrafos cortos de 1-3 líneas para facilitar el scroll del teleprompter
4. Elimina numeración de páginas, encabezados técnicos, tablas rotas y basura de formato
5. Conserva el mensaje, datos y nombres importantes del autor
${podcast ? `Podcast: ${podcast}` : ''}${topic ? `\nTema del episodio: ${topic}` : ''}${guest ? `\nInvitado: ${guest}` : ''}

Responde SOLO con el guion final listo para teleprompter. Sin títulos, sin explicaciones, sin markdown.`
      const text = await callAI(prompt)
      return text.trim()
    } catch (e) {
      setError(e.message || 'Error al formatear el documento')
      return null
    } finally {
      setLoadingScript(false)
    }
  }, [])

  const generateTeleprompterScript = useCallback(async ({ podcast, topic, guest, role, durationMin = 5 }) => {
    setLoadingScript(true)
    setError('')
    try {
      const prompt = `Escribe un guion de teleprompter para un episodio de podcast en español latinoamericano.
Podcast: ${podcast}
Tema: ${topic}
Invitado: ${guest || 'sin invitado'}${role ? ` (${role})` : ''}
Duración aproximada: ${durationMin} minutos al leer en voz alta.

Estructura: saludo, presentación, desarrollo del tema en párrafos cortos, cierre con llamada a la acción.
Escribe SOLO el guion, sin títulos. Tono conversacional, como si hablaras a cámara.`
      const text = await callAI(prompt)
      return text.trim()
    } catch (e) {
      setError(e.message || 'Error al generar guion')
      return null
    } finally {
      setLoadingScript(false)
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

      const raw = await callAI(prompt)
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setPosts(parsed)
      return parsed
    } catch (e) {
      setError(e.message || 'Error al generar posts. Verifica tu conexión y vuelve a intentar.')
      return null
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  return {
    generateCintillo, generateTeleprompterScript, formatTeleprompterDocument, generatePosts,
    loadingPosts, loadingCintillo, loadingScript,
    posts, setPosts, error, aiConfigured, checkAIStatus,
  }
}
