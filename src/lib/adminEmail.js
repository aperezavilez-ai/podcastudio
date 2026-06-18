/** Correo admin oficial y variantes con typo frecuentes. */
export const ADMIN_EMAIL = 'alfonsoavilery@icloud.com'

const TYPO_MAP = {
  'alfonsoevilery@icloud.com': ADMIN_EMAIL,
  'alfonsovillery@icloud.com': ADMIN_EMAIL,
  'alfonsoavilery@icloud.com': ADMIN_EMAIL,
}

export function normalizeLoginEmail(email) {
  const e = (email || '').trim().toLowerCase()
  return TYPO_MAP[e] || e
}
