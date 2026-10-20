const { getMercadoPago, getPayment } = require('./client.js')
const { upsertSubscriptionFromMP } = require('./subscriptions.js')
const { verifyMercadoPagoSignature, verifyTimestamp } = require('./signature.js')

async function handleMPWebhook(rawBody, signature) {
  const mp = getMercadoPago()
  if (!mp) throw new Error('Mercado Pago no configurado')

  // Validar firma del webhook (CRÍTICO para seguridad)
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (webhookSecret) {
    // Verificar timestamp primero (prevenir replay attacks)
    if (!verifyTimestamp(signature, 300)) {
      throw new Error('Webhook timestamp inválido o muy antiguo')
    }

    // Verificar firma HMAC
    const isValid = verifyMercadoPagoSignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      throw new Error('Firma de webhook inválida')
    }
  } else {
    console.warn('[MP Webhook] ⚠️ MERCADO_PAGO_WEBHOOK_SECRET no configurado - webhook SIN validar')
  }

  // Mercado Pago webhook: parse body and handle payment events
  let event
  try {
    event = JSON.parse(rawBody.toString())
  } catch {
    throw new Error('Body inválido')
  }

  if (event.type === 'payment') {
    const paymentId = event.data?.id
    if (!paymentId) return { type: 'ignored' }

    const payment = await getPayment(paymentId)
    const approved = payment.status === 'approved'
    if (!approved) return { type: 'payment_not_approved' }

    const planId = payment.metadata?.plan_id
    if (!planId) return { type: 'no_plan' }

    // Find user by payer email
    const payerEmail = payment.payer?.email
    if (!payerEmail) return { type: 'no_payer' }

    const { getSupabaseAdmin } = require('../supabase/admin.js')
    const admin = getSupabaseAdmin()
    if (!admin) throw new Error('Supabase admin no configurado')

    // Buscar usuario en auth.users usando Admin API
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers()
    if (listError) throw new Error(`Error listando usuarios: ${listError.message}`)

    const user = users.find(u => u.email === payerEmail)
    if (!user) return { type: 'user_not_found' }

    await upsertSubscriptionFromMP({
      userId: user.id,
      planId,
      status: payment.status,
      mpPreferenceId: payment.preference_id,
      mpPaymentId: payment.id,
      mpPayerId: payment.payer?.id,
    })

    return { type: 'payment_approved' }
  }

  return { type: 'ignored' }
}

module.exports = {
  handleMPWebhook,
}