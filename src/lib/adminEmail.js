/** Correo admin oficial y variantes con typo frecuentes. */
export const ADMIN_EMAIL = 'alfonsoavilez@icloud.com'
export const WRONG_EMAIL_EXAMPLE = 'alfonsoavilery@icloud.com'

const TYPO_MAP = {
  'alfonsoevilery@icloud.com': ADMIN_EMAIL,
  'alfonsovillery@icloud.com': ADMIN_EMAIL,
  'alfonsoavilery@icloud.com': ADMIN_EMAIL,
  'alfonsoaviler@icloud.com': ADMIN_EMAIL,
  'aperezavilez@gmail.com': ADMIN_EMAIL,
}

export function normalizeLoginEmail(email) {
  const e = (email || '').trim().toLowerCase()
  return TYPO_MAP[e] || e
}

export function isKnownEmailTypo(email) {
  const e = (email || '').trim().toLowerCase()
  return e in TYPO_MAP && e !== ADMIN_EMAIL
}
