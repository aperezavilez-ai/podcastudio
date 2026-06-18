import { useCallback, useEffect, useState } from 'react'
import { detectBrowser } from '../lib/pwaBrowser.js'

function waitForInstallPrompt(existing, timeoutMs = 5000) {
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      resolve(null)
    }, timeoutMs)

    function onPrompt(e) {
      e.preventDefault()
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      resolve(e)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
  })
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [browser] = useState(() => detectBrowser())

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
    }

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    const prompt = await waitForInstallPrompt(deferred, 5000)
    if (prompt && prompt !== deferred) setDeferred(prompt)
    if (!prompt) return false

    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setDeferred(null)
      setInstalled(true)
    }
    return outcome === 'accepted'
  }, [deferred])

  const canInstall = !!deferred && !installed
  const canShowInstall = !installed

  return { canInstall, canShowInstall, installed, browser, install }
}
