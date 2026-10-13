import { supabase, withTimeout } from './supabase.js'

async function authHeaders() {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function startCheckout(planId, email, userId) {
  const res = await fetch('/api/mercadopago/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, email, userId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el pago')
  if (data.url) window.location.href = data.url
  return data
}

export async function verifyCheckoutSession(paymentId) {
  const res = await fetch(`/api/mercadopago/session?payment_id=${encodeURIComponent(paymentId)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo verificar el pago')
  return data
}

export async function syncCheckoutSession(paymentId) {
  const res = await fetch('/api/mercadopago/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify({ paymentId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo activar el plan')
  return data
}

export async function fetchSubscription() {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  try {
    const res = await withTimeout(
      fetch('/api/mercadopago/subscription', { headers }),
      8000,
      null,
    )
    if (!res) return null
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return null
    return data
  } catch {
    return null
  }
}

export function saveLocalPlan(planId) {
  if (!planId) return
  localStorage.setItem('podcastudio_plan', planId)
  localStorage.setItem('podcastudio_plan_active', 'true')
}

export function getLocalPlan() {
  return localStorage.getItem('podcastudio_plan')
}

export async function checkMPStatus() {
  try {
    const res = await fetch('/api/mercadopago/status')
    return await res.json()
  } catch {
    return { configured: false }
  }
}