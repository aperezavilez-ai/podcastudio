const { getMercadoPago, getPayment } = require('./client.js')
const { upsertSubscriptionFromMP } = require('./subscriptions.js')

async function syncPaymentForUser(paymentId, userId) {
  const payment = await getPayment(paymentId)
  const approved = payment.status === 'approved'

  if (!approved) return { ok: false, planId: null }

  const planId = payment.metadata?.plan_id
  if (!planId) {
    throw new Error('Plan inválido en el pago')
  }

  await upsertSubscriptionFromMP({
    userId,
    planId,
    status: payment.status,
    mpPreferenceId: payment.preference_id,
    mpPaymentId: payment.id,
    mpPayerId: payment.payer?.id,
  })

  return { ok: true, planId }
}

module.exports = {
  syncPaymentForUser,
}
