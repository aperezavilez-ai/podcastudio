import { useState, useCallback, useEffect } from 'react'

import { MUSIC_TRACKS, MUSIC_GENRES } from '../config/musicTracks.js'

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
  const [loadingProducer, setLoadingProducer] = useState(false)
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

  const analyzeEventWithAI = useCallback(async (project) => {
    setLoadingProducer(true)
    setError('')
    const trackIds = MUSIC_TRACKS.map(t => t.id).join(', ')
    const genres = Object.entries(MUSIC_GENRES).map(([k, v]) => `${k}=${v}`).join(', ')
    try {
      const prompt = `Eres la productora IA de un estudio de podcast profesional en español latinoamericano.
Analiza este evento/episodio y genera la configuración automática del estudio.

Datos del evento:
- Podcast: ${project.name || 'Sin nombre'}
- Episodio: ${project.episodeTitle || 'Sin título'}
- Invitado: ${project.guestName || 'N/A'}
- Cargo: ${project.guestRole || 'N/A'}
- Descripción: ${project.eventDescription || project.episodeTitle || 'Podcast general'}
- Guion existente: ${(project.teleprompterScript || '').slice(0, 2000) || 'ninguno'}

Géneros musicales disponibles: ${genres}
IDs de pista musical: ${trackIds}

Responde SOLO JSON válido sin backticks:
{
  "genre": "tech|business|interview|comedy|news|wellness|sports|culture|education|marketing|crime|general",
  "musicTrackId": "id de la lista anterior",
  "musicVolume": 18-35,
  "cintillos": {
    "topic": "texto cintillo tema max 60 chars",
    "guest": "nombre y cargo invitado max 60 chars",
    "social": "handle redes max 40 chars",
    "contact": "contacto o CTA max 50 chars",
    "promo": "promo opcional max 50 chars"
  },
  "cintilloRotation": ["topic","guest","social","contact"],
  "subtitlesEnabled": true,
  "subtitleLanguage": "es-MX",
  "directorMode": "ai",
  "autoCintillos": true,
  "teleprompterScript": "guion corto 150-400 palabras si no hay guion, o vacío si ya hay uno bueno",
  "producerSummary": "una frase de qué hará la IA en este episodio"
}`
      const raw = await callAI(prompt, 'Responde únicamente JSON válido. Sin markdown.')
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      if (!parsed.cintillos) throw new Error('Respuesta IA incompleta')
      return parsed
    } catch (e) {
      setError(e.message || 'Error al analizar el evento')
      return null
    } finally {
      setLoadingProducer(false)
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
    analyzeEventWithAI,
    loadingPosts, loadingCintillo, loadingScript, loadingProducer,
    posts, setPosts, error, aiConfigured, checkAIStatus,
  }
}
