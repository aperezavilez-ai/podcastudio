/**
 * Muestra la configuración de URLs que debes tener en Supabase Dashboard:
 * Authentication → URL Configuration
 */
const site = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.podcastudio.mx'
const base = site.replace(/\/$/, '')

console.log('Configura en Supabase → Authentication → URL Configuration:\n')
console.log('Site URL:')
console.log(`  ${base}`)
console.log('\nRedirect URLs (añade todas):')
console.log(`  ${base}/**`)
console.log('  http://localhost:3000/**')
console.log('\nGuarda y espera unos segundos antes de probar el login.')
