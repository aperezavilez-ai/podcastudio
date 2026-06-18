import { useCallback, useRef } from 'react'
import { resolveMusicTrack } from '../config/musicTracks.js'

export function applyAIProducerPlan(project, plan) {
  if (!plan) return project
  const next = { ...project, aiPlan: plan, aiPlanAt: Date.now() }
  next.cintillos = { ...(project.cintillos || {}), ...(plan.cintillos || {}) }
  if (plan.teleprompterScript && !project.teleprompterScript?.trim()) {
    next.teleprompterScript = plan.teleprompterScript
  }
  if (plan.genre) next.podcastGenre = plan.genre
  if (plan.musicTrackId) next.musicTrackId = plan.musicTrackId
  if (plan.musicVolume != null) next.musicVolume = plan.musicVolume
  if (plan.subtitlesEnabled != null) next.subtitlesEnabled = plan.subtitlesEnabled
  if (plan.subtitleLanguage) next.subtitleLanguage = plan.subtitleLanguage
  if (plan.directorMode) next.directorMode = plan.directorMode
  if (plan.autoCintillos != null) next.autoCintillos = plan.autoCintillos
  if (plan.cintilloRotation) next.cintilloRotation = plan.cintilloRotation
  return next
}

export function useAIProducer({ analyzeEventWithAI, aiConfigured }) {
  const ranRef = useRef(false)

  const runProducer = useCallback(async (project) => {
    if (!aiConfigured || !project) return { project, plan: null, status: 'sin_ia' }
    if (project.aiPlan?.producerSummary && project.aiPlanAt) {
      return { project, plan: project.aiPlan, status: 'cached' }
    }
    const plan = await analyzeEventWithAI(project)
    if (!plan) return { project, plan: null, status: 'error' }
    const enriched = applyAIProducerPlan(project, plan)
    const music = resolveMusicTrack(plan.musicTrackId, plan.genre)
    return {
      project: enriched,
      plan,
      music,
      status: 'ready',
    }
  }, [analyzeEventWithAI, aiConfigured])

  const shouldAutoRun = useCallback((project) => {
    if (!aiConfigured || ranRef.current) return false
    if (!project?.episodeTitle && !project?.name) return false
    return !project.aiPlan?.producerSummary
  }, [aiConfigured])

  const markRan = useCallback(() => { ranRef.current = true }, [])

  return { runProducer, shouldAutoRun, markRan }
}
