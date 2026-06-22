/** Teclas de plumas inalámbricas y teclado para controlar el teleprompter. */
const DEBOUNCE_MS = 320

const TOGGLE_CODES = new Set([
  'Space',
  'PageDown',
  'ArrowRight',
  'Enter',
  'NumpadEnter',
])

const RESET_CODES = new Set([
  'PageUp',
  'Home',
])

export function isTeleprompterFormField(target) {
  const tag = target?.tagName
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return true
  return Boolean(target?.isContentEditable)
}

export function handleTeleprompterKeydown(e, { onToggle, onReset, lastActionRef }) {
  if (isTeleprompterFormField(e.target)) return false

  const isToggle = TOGGLE_CODES.has(e.code) || e.key === ' '
  const isReset = RESET_CODES.has(e.code)
  if (!isToggle && !isReset) return false

  const now = Date.now()
  if (lastActionRef?.current && now - lastActionRef.current < DEBOUNCE_MS) {
    e.preventDefault()
    return true
  }

  e.preventDefault()
  if (lastActionRef) lastActionRef.current = now

  if (isReset) {
    onReset?.()
    return true
  }

  onToggle?.()
  return true
}

export const TELEPROMPTER_REMOTE_HINT =
  'Pluma o teclado: Av. Pág / Enter / → = play-pausa · Re. Pág / Inicio = reiniciar guion'
