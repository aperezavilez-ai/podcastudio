import { supabase } from './supabase.js'

async function authHeaders() {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function startCheckout(planId, email, userId) {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, email, userId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el pago')
  if (data.url) window.location.href = data.url
  return data
}

export async function verifyCheckoutSession(sessionId) {
  const res = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo verificar el pago')
  return data
}

export async function syncCheckoutSession(sessionId) {
  const res = await fetch('/api/stripe/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify({ sessionId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo activar el plan')
  return data
}

export async function fetchSubscription() {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  const res = await fetch('/api/stripe/subscription', { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return data
}

export async function openBillingPortal() {
  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo abrir el portal')
  if (data.url) window.location.href = data.url
  return data
}

export function saveLocalPlan(planId) {
  if (!planId) return
  localStorage.setItem('podcastudio_plan', planId)
  localStorage.setItem('podcastudio_plan_active', 'true')
}

export function getLocalPlan() {
  return localStorage.getItem('podcastudio_plan')
}

export async function checkStripeStatus() {
  try {
    const res = await fetch('/api/stripe/status')
    return await res.json()
  } catch {
    return { configured: false }
  }
}
