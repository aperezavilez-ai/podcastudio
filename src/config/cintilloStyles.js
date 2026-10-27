export const CINTILLO_STYLES = [
  { id: 'glass', name: 'Cristal Broadcast', desc: 'Cristal ahumado translúcido con barrido de luz TV', colors: { primary: '#e8612a', secondary: 'rgba(255,255,255,0.18)' } },
  { id: 'cyber', name: 'Cíber Neón', desc: 'Cristal oscuro con resplandor holográfico 3D', colors: { primary: '#00f2fe', secondary: 'rgba(0,242,254,0.2)' } },
  { id: 'news', name: 'Noticiero en Vivo', desc: 'Doble nivel broadcast titular + bajada de texto', colors: { primary: '#ef4444', secondary: 'rgba(15,23,42,0.85)' } },
  { id: 'metallic', name: 'Metálico VIP', desc: 'Elegancia dorada con reflejos especulares de alta gama', colors: { primary: '#fbbf24', secondary: 'rgba(251,191,36,0.18)' } },
  { id: 'minimal', name: 'Estudio Minimalista', desc: 'Ultra translúcido con línea de luz sutil', colors: { primary: '#60a5fa', secondary: 'rgba(255,255,255,0.08)' } },
  { id: 'classic', name: 'Clásico Profesional', desc: 'Barra de acento lateral y cristal biselado', colors: { primary: '#e8612a', secondary: 'rgba(10,12,18,0.75)' } },
  { id: 'angled', name: 'Angulado', desc: 'Trapecio dinámico cinemático', colors: { primary: '#e8612a', secondary: '#ffffff' } },
  { id: 'broadcast', name: 'Banderín TV', desc: 'Banderín dinámico con barra translúcida', colors: { primary: '#e05050', secondary: '#ffffff' } },
  { id: 'profile', name: 'Con Foto', desc: 'Avatar circular flotante', colors: { primary: '#e05050', secondary: '#ffffff' } },
  { id: 'neon', name: 'Neón Glow', desc: 'Borde luminoso futurista', colors: { primary: '#febc2e', secondary: '#111118' } },
  { id: 'sport', name: 'Deportivo', desc: 'Vertical + arco dinámico de evento', colors: { primary: '#e05050', secondary: '#e8612a' } },
  { id: 'corporate', name: 'Corporativo', desc: 'Rayas profesionales de negocios', colors: { primary: '#4a90d9', secondary: '#ffffff' } },
  { id: 'premium', name: 'Premium VIP', desc: 'Bloque exclusivo con acento degradado', colors: { primary: '#a855f7', secondary: '#ffffff' } },
];

export function getCintilloStyle(id) {
  return CINTILLO_STYLES.find(s => s.id === id) || CINTILLO_STYLES[0]
}
