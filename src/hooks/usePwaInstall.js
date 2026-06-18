import { useCallback, useEffect, useState } from 'react'

export function usePwaInstall() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const ios = /iphone|ipad|ipod/i.test(ua)
      && typeof window !== 'undefined'
      && !window.navigator.standalone
    setIsIos(ios)

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
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setDeferred(null)
    return outcome === 'accepted'
  }, [deferred])

  const canInstall = !!deferred && !installed
  const showIosHint = isIos && !installed

  return { canInstall, installed, showIosHint, install }
}
