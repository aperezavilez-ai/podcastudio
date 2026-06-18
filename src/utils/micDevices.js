const BUILTIN_PATTERNS = [
  /built[- ]?in/i,
  /internal/i,
  /integrated/i,
  /default.*micro/i,
  /micrófono.*predeterminado/i,
  /array de micro/i,
  /macbook/i,
  /laptop/i,
  /realtek.*array/i,
  /intel.*smart/i,
]

const EXTERNAL_PATTERNS = [
  /usb/i,
  /external/i,
  /blue\s*yeti/i,
  /rode/i,
  /shure/i,
  /audio-technica/i,
  /hyperx/i,
  /elgato/i,
  /fifine/i,
  /maono/i,
  /\bbm\d/i,
  /podcast/i,
  /headset/i,
  /headphone/i,
  /auricular/i,
  /jabra/i,
  /logitech/i,
  /sennheiser/i,
  /focusrite/i,
  /presonus/i,
  /zoom\s/i,
  /wireless/i,
  /bluetooth/i,
]

export function isBuiltInMicrophone(label = '') {
  const l = label.toLowerCase()
  if (EXTERNAL_PATTERNS.some(p => p.test(l))) return false
  if (!l || l === 'default') return true
  return BUILTIN_PATTERNS.some(p => p.test(l))
}

export function rankMicrophones(microphones) {
  return [...microphones].map(mic => {
    const label = mic.label || ''
    let score = 0
    if (EXTERNAL_PATTERNS.some(p => p.test(label))) score += 100
    if (/usb/i.test(label)) score += 40
    if (isBuiltInMicrophone(label)) score -= 80
    return { mic, score }
  }).sort((a, b) => b.score - a.score)
}

export function pickPreferredMicrophone(microphones) {
  const ranked = rankMicrophones(microphones)
  return ranked[0]?.mic ?? null
}

export function getMicrophoneType(label = '') {
  return isBuiltInMicrophone(label) ? 'builtin' : 'external'
}
