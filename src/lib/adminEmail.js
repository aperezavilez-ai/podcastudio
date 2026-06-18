/** Correo admin oficial y variantes con typo frecuentes. */
export const ADMIN_EMAIL = 'alfonsoavilery@icloud.com'
export const WRONG_EMAIL_EXAMPLE = 'alfonsoevilery@icloud.com'

const TYPO_MAP = {
  [WRONG_EMAIL_EXAMPLE]: ADMIN_EMAIL,
  'alfonsovillery@icloud.com': ADMIN_EMAIL,
}

export function normalizeLoginEmail(email) {
  const e = (email || '').trim().toLowerCase()
  return TYPO_MAP[e] || e
}

export function isKnownEmailTypo(email) {
  const e = (email || '').trim().toLowerCase()
  return e in TYPO_MAP && e !== ADMIN_EMAIL
}
