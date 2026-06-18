/** Detección del navegador actual para instrucciones de instalación PWA. */
export function detectBrowser() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''

  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/edg\//i.test(ua)) return 'edge'
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'opera'
  if (/samsungbrowser/i.test(ua)) return 'samsung'
  if (/firefox|fxios/i.test(ua)) return 'firefox'
  if (/chrome|crios/i.test(ua)) return 'chrome'
  if (/safari/i.test(ua)) return 'safari'
  return 'other'
}

export function getBrowserLabel(browser) {
  const labels = {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    firefox: 'Firefox',
    safari: 'Safari',
    ios: 'Safari (iPhone/iPad)',
    android: 'Chrome (Android)',
    samsung: 'Samsung Internet',
    opera: 'Opera',
    other: 'tu navegador',
  }
  return labels[browser] || labels.other
}

/** Instrucciones cuando no hay diálogo nativo (beforeinstallprompt). */
export function getManualInstallSteps(browser) {
  switch (browser) {
    case 'chrome':
    case 'android':
      return [
        'Abre el menú ⋮ (esquina superior derecha).',
        'Elige «Instalar aplicación» o «Instalar PodcastStudio».',
        'Confirma en el cuadro del sistema.',
      ]
    case 'edge':
      return [
        'Abre el menú ⋯ (tres puntos).',
        'Ve a «Aplicaciones» → «Instalar este sitio como aplicación».',
        'Pulsa «Instalar».',
      ]
    case 'firefox':
      return [
        'Abre el menú ☰.',
        'Selecciona «Instalar» (si aparece) o el icono de instalación en la barra de direcciones.',
      ]
    case 'ios':
      return [
        'Toca el botón Compartir ⬆️ en la barra inferior.',
        'Desliza y elige «Añadir a pantalla de inicio».',
        'Pulsa «Añadir».',
      ]
    case 'safari':
      return [
        'En la barra de menú: «Archivo» → «Añadir al Dock».',
        'O en iPhone: Compartir → «Añadir a pantalla de inicio».',
      ]
    case 'samsung':
      return [
        'Menú ≡ → «Añadir página a» → «Pantalla de inicio».',
        'O «Instalar aplicación» si aparece en el menú.',
      ]
    case 'opera':
      return [
        'Menú → «Instalar…» o el icono ⊕ en la barra de direcciones.',
      ]
    default:
      return [
        'Busca en el menú del navegador «Instalar aplicación» o «Añadir a pantalla de inicio».',
        'También puede aparecer un icono de instalación en la barra de direcciones.',
      ]
  }
}

export function getReadyHint(browser, canNativeInstall) {
  if (canNativeInstall) {
    return 'Listo para instalar con un clic en este navegador.'
  }
  const name = getBrowserLabel(browser)
  return `Instalación disponible en ${name}. Pulsa el botón y sigue los pasos.`
}
