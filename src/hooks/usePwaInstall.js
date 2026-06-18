import { useCallback, useEffect, useState } from 'react'
import { detectBrowser } from '../lib/pwaBrowser.js'
import {
  detectInstalledRelatedApp,
  isStandaloneMode,
  markPwaInstalled,
  wasPwaInstalled,
} from '../lib/pwaStorage.js'

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
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode())
  const [installedOnDevice, setInstalledOnDevice] = useState(() => wasPwaInstalled())
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [browser] = useState(() => detectBrowser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setIsStandalone(isStandaloneMode())

    async function detect() {
      if (wasPwaInstalled() || isStandaloneMode()) {
        setInstalledOnDevice(true)
        setReady(true)
        return
      }
      const related = await detectInstalledRelatedApp()
      if (related) {
        markPwaInstalled()
        setInstalledOnDevice(true)
      }
      setReady(true)
    }

    detect()

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      markPwaInstalled()
      setInstalledOnDevice(true)
      setIsStandalone(isStandaloneMode())
      setDeferred(null)
    }
    const onUpdate = () => setUpdateAvailable(true)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('pwa-update-available', onUpdate)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('pwa-update-available', onUpdate)
    }
  }, [])

  const install = useCallback(async () => {
    const prompt = await waitForInstallPrompt(deferred, 5000)
    if (prompt && prompt !== deferred) setDeferred(prompt)
    if (!prompt) return false

    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      markPwaInstalled()
      setInstalledOnDevice(true)
      setDeferred(null)
    }
    return outcome === 'accepted'
  }, [deferred])

  const canInstall = !!deferred && !installedOnDevice && !isStandalone
  const showInstallUi = ready && !isStandalone && !installedOnDevice
  const showUpdateUi = ready && updateAvailable && (isStandalone || installedOnDevice)

  return {
    ready,
    canInstall,
    showInstallUi,
    showUpdateUi,
    isStandalone,
    installedOnDevice,
    updateAvailable,
    installed: isStandalone,
    browser,
    install,
    setUpdateAvailable,
  }
}
