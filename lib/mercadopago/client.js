import MercadoPago from 'mercadopago'

let mpClient = null

function getMercadoPago() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) return null
  if (!mpClient) {
    mpClient = new MercadoPago({
      accessToken,
      options: {
        timeout: 20000,
      },
    })
  }
  return mpClient
}

function isMercadoPagoConfigured() {
  return !!process.env.MERCADO_PAGO_ACCESS_TOKEN
}

function getSiteUrl() {
  return process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.podcastudio.mx'
}

async function createPreference({ planId, customerEmail, userId }) {
  const mp = getMercadoPago()
  if (!mp) throw new Error('Mercado Pago no configurado')

  const site = getSiteUrl()
  const isAnnual = planId === 'annual'
  const amount = isAnnual ? 828 : planId === 'pro' ? 89 : 39

  const preference = {
    body: {
      items: [
        {
          id: planId,
          title: `PodcastStudio ${planId === 'starter' ? 'Starter' : planId === 'pro' ? 'Pro' : 'Anual Pro'}`,
          description: `Plan ${planId} de PodcastStudio`,
          currency_id: 'MXN',
          category_id: 'services',
          quantity: 1,
          unit_price: amount,
        },
      ],
      payer: customerEmail
        ? { email: customerEmail }
        : undefined,
      back_urls: {
        success: `${site}/plans?checkout=success&plan=${planId}`,
        failure: `${site}/plans?checkout=cancel`,
        pending: `${site}/plans?checkout=pending`,
      },
      auto_return: 'approved',
      payment_methods: {
        excluded_payment_methods: [],
        installments: 1,
      },
      metadata: {
        plan_id: planId,
        user_id: userId || '',
      },
      notification_url: `${site}/api/mercadopago/webhook`,
    },
  }

  const result = await mp.preferences.create(preference)
  return result
}

async function getPreference(preferenceId) {
  const mp = getMercadoPago()
  if (!mp) throw new Error('Mercado Pago no configurado')
  return mp.preferences.get(preferenceId)
}

async function getPayment(paymentId) {
  const mp = getMercadoPago()
  if (!mp) throw new Error('Mercado Pago no configurado')
  return mp.payment.get(paymentId)
}

export {
  getMercadoPago,
  isMercadoPagoConfigured,
  getSiteUrl,
  createPreference,
  getPreference,
  getPayment,
}