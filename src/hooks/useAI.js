import { useState, useCallback, useEffect } from 'react'

import { MUSIC_TRACKS, MUSIC_GENRES } from '../config/musicTracks.js'
import { getAccessToken } from '../lib/supabase.js'

const AI_TIMEOUT_MS = 45_000
const aiCache = new Map()

function cacheKey(task, prompt) {
  let hash = 0
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) - hash) + prompt.charCodeAt(i)
    hash |= 0
  }
  return `${task}:${hash}`
}

function safeParseJSON(raw, fallback = null) {
  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    console.warn('[AI] JSON inválido:', raw?.slice(0, 200))
    return fallback
  }
}

function isRetryableError(error) {
  const code = error?.code
  return code === 'RATE_LIMITED' || code === 'TIMEOUT' || code === 'API_ERROR' || code === 'EMPTY_RESPONSE'
}

function getRetryDelay(error, attempt) {
  if (error?.code === 'RATE_LIMITED') return (error.details?.retryAfter || 60) * 1000
  return Math.min(1000 * Math.pow(2, attempt), 10_000)
}

const PROMPTS = {
  cintillo: ({ topic, guest, role, type }) => `Genera un cintillo de ${type === 'guest' ? 'presentación del invitado' : 'tema'} para un podcast en español latinoamericano.
Invitado: ${guest || 'N/A'}, Cargo: ${role || 'N/A'}, Tema: ${topic || 'N/A'}
Tipo: ${type}
Responde SOLO el texto del cintillo, máximo 60 caracteres, sin comillas ni explicaciones.`,

  teleprompterFormat: ({ rawText, podcast, topic, guest }) => `Eres editor profesional de guiones para teleprompter de podcasts en español latinoamericano.

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

Responde SOLO con el guion final listo para teleprompter. Sin títulos, sin explicaciones, sin markdown.`,

  teleprompterGenerate: ({ podcast, topic, guest, role, durationMin = 5 }) => `Escribe un guion de teleprompter para un episodio de podcast en español latinoamericano.
Podcast: ${podcast}
Tema: ${topic}
Invitado: ${guest || 'sin invitado'}${role ? ` (${role})` : ''}
Duración aproximada: ${durationMin} minutos al leer en voz alta.

Estructura: saludo, presentación, desarrollo del tema en párrafos cortos, cierre con llamada a la acción.
Escribe SOLO el guion, sin títulos. Tono conversacional, como si hablaras a cámara.`,

  producer: ({ project, trackIds, genres }) => `Eres la productora IA de un estudio de podcast profesional en español latinoamericano.
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
  "genre": "rock|popelectro|reggae|lofi|corporate|synthwave|interview|comedy|news|wellness|crime|general",
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
}`,

  posts: ({ podcast, topic, guest, role, description, platforms }) => {
    const platList = platforms.join(', ')
    return `Eres experto en marketing de podcasts en español para Latinoamérica.

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
  },
}

async function callAI(prompt, systemPrompt, task, retries = 2) {
  const key = cacheKey(task, prompt)
  const cached = aiCache.get(key)
  if (cached) return cached

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, systemPrompt, task }),
        signal: controller.signal,
      })
      clearTimeout(id)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.error || `Error ${res.status}`
        const err = new Error(msg)
        err.code = data.code
        err.details = data
        throw err
      }
      aiCache.set(key, data.text)
      return data.text
    } catch (e) {
      clearTimeout(id)
      if (e.name === 'AbortError') {
        const err = new Error('La IA tardó demasiado. Intenta de nuevo.')
        err.code = 'TIMEOUT'
        throw err
      }
      if (attempt < retries && isRetryableError(e)) {
        const delay = getRetryDelay(e, attempt)
        console.log(`[AI] Reintento ${attempt + 1}/${retries} en ${delay}ms:`, e.message)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw e
    }
  }
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
      const prompt = PROMPTS.cintillo({ topic, guest, role, type })
      const text = await callAI(prompt, '', 'cintillo')
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
      const prompt = PROMPTS.teleprompterFormat({ rawText, podcast, topic, guest })
      const text = await callAI(prompt, '', 'teleprompterFormat')
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
      const prompt = PROMPTS.teleprompterGenerate({ podcast, topic, guest, role, durationMin })
      const text = await callAI(prompt, '', 'teleprompterGenerate')
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
      const prompt = PROMPTS.producer({ project, trackIds, genres })
      const raw = await callAI(prompt, 'Responde únicamente JSON válido. Sin markdown.', 'producer')
      const parsed = safeParseJSON(raw)
      if (!parsed?.cintillos) throw new Error('Respuesta IA incompleta')
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
      const prompt = PROMPTS.posts({ podcast, topic, guest, role, description, platforms })
      const raw = await callAI(prompt, '', 'posts')
      const parsed = safeParseJSON(raw)
      if (!parsed) throw new Error('Respuesta IA inválida')
      setPosts(parsed)
      return parsed
    } catch (e) {
      setError(e.message || 'Error al generar posts. Verifica tu conexión y vuelve a intentar.')
      return null
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  const clearError = useCallback(() => setError(''), [])

  return {
    generateCintillo,
    generateTeleprompterScript,
    formatTeleprompterDocument,
    generatePosts,
    analyzeEventWithAI,
    loadingPosts,
    loadingCintillo,
    loadingScript,
    loadingProducer,
    posts,
    setPosts,
    error,
    clearError,
    aiConfigured,
    checkAIStatus,
  }
}