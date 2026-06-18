import { buildEmail } from './templates.js'

const RESEND_API = 'https://api.resend.com/emails'

export function isResendConfigured() {
  return !!process.env.RESEND_API_KEY
}

export function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || 'PodcastStudio <onboarding@resend.dev>'
}

export async function sendResendEmail({ to, subject, html, apiKey }) {
  const key = apiKey || process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY no configurada')

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Resend error ${res.status}`)
  }
  return body
}

export async function sendNotificationEmail({ type, to, data, apiKey }) {
  const { subject, html } = buildEmail(type, data)
  return sendResendEmail({ to, subject, html, apiKey })
}
