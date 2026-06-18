export async function startCheckout(planId, email) {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, email }),
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
