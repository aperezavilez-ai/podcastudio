export const CINTILLO_STYLES = [
  { id: 'classic', name: 'Clásico', desc: 'Barra con acento lateral', colors: { primary: '#e8612a', secondary: '#0a0a10' } },
  { id: 'angled', name: 'Angulado', desc: 'Trapecio dinámico', colors: { primary: '#e8612a', secondary: '#ffffff' } },
  { id: 'broadcast', name: 'Broadcast', desc: 'Estilo TV en vivo', colors: { primary: '#e05050', secondary: '#ffffff' } },
  { id: 'profile', name: 'Con foto', desc: 'Avatar circular', colors: { primary: '#e05050', secondary: '#ffffff' } },
  { id: 'tab', name: 'Con etiqueta', desc: 'Pestaña superior', colors: { primary: '#e05050', secondary: '#febc2e' } },
  { id: 'news', name: 'Informativo', desc: 'Caja de noticias', colors: { primary: '#4a90d9', secondary: '#111118' } },
  { id: 'elegant', name: 'Elegante', desc: 'Línea de acento', colors: { primary: '#9d8ce8', secondary: '#ffffff' } },
  { id: 'wave', name: 'Onda', desc: 'Fondo ondulado', colors: { primary: '#7c5cbf', secondary: '#ffffff' } },
  { id: 'neon', name: 'Neón', desc: 'Borde luminoso', colors: { primary: '#febc2e', secondary: '#111118' } },
  { id: 'sport', name: 'Deportivo', desc: 'Vertical + evento', colors: { primary: '#e05050', secondary: '#e8612a' } },
  { id: 'corporate', name: 'Corporativo', desc: 'Rayas profesionales', colors: { primary: '#4a90d9', secondary: '#ffffff' } },
  { id: 'premium', name: 'Premium', desc: 'Bloque exclusivo', colors: { primary: '#7c5cbf', secondary: '#ffffff' } },
]

export function getCintilloStyle(id) {
  return CINTILLO_STYLES.find(s => s.id === id) || CINTILLO_STYLES[0]
}
