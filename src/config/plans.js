export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    interval: 'month',
    intervalLabel: '/mes',
    description: 'Para empezar tu podcast con calidad profesional.',
    features: [
      '2 cámaras simultáneas',
      'Cintillos básicos',
      '20 posts IA / mes',
      'Grabación HD 1080p',
      'Descarga WebM / MP4',
      'Teleprompter + guion Word',
    ],
    featured: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    interval: 'month',
    intervalLabel: '/mes',
    description: 'Estudio completo para creadores serios.',
    features: [
      '3 cámaras simultáneas',
      'Director IA de cámaras',
      'Cintillos y posts IA ilimitados',
      'Grabación HD 1080p',
      'Música sin copyright',
      'Logo en pantalla',
      'Publicación opcional a YouTube',
    ],
    featured: true,
    badge: 'Más popular',
  },
  {
    id: 'annual',
    name: 'Anual Pro',
    price: 69,
    interval: 'year',
    intervalLabel: '/mes',
    billed: 828,
    billedLabel: 'facturado $828/año',
    save: 'Ahorras $240 al año',
    description: 'Todo Pro con el mejor precio.',
    features: [
      'Todo lo de Pro',
      'Descarga y publica en tus redes',
      'Soporte prioritario',
      'Onboarding personalizado',
    ],
    featured: false,
  },
]

export function getPlan(id) {
  return PLANS.find(p => p.id === id) || null
}
