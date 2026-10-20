const { getPayment } = require('../../lib/mercadopago/client.js')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const paymentId = req.query?.payment_id
  if (!paymentId) {
    res.status(400).json({ error: 'Falta payment_id' })
    return
  }
  try {
    const payment = await getPayment(paymentId)
    const approved = payment?.status === 'approved'
    res.status(200).json({
      ok: approved,
      planId: payment?.metadata?.plan_id || null,
      status: payment?.status,
    })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error al verificar pago' })
  }
}