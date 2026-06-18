/**
 * Uso (solo servidor, una vez):
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/reset-admin-users.mjs
 * Requiere SUPABASE_SERVICE_ROLE_KEY y VITE_SUPABASE_URL en el entorno.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD || ''

if (!url || !serviceKey) {
  console.error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!adminEmail || !adminPassword) {
  console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD en el entorno')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function listAllUsers() {
  const all = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    all.push(...(data.users || []))
    if ((data.users || []).length < 200) break
    page += 1
  }
  return all
}

async function main() {
  const users = await listAllUsers()
  console.log(`Usuarios encontrados: ${users.length}`)

  let admin = users.find(u => u.email?.toLowerCase() === adminEmail)

  for (const user of users) {
    if (user.email?.toLowerCase() === adminEmail) continue
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.error(`No se pudo borrar ${user.email}:`, error.message)
    } else {
      console.log(`Eliminado: ${user.email || user.id}`)
    }
  }

  if (!admin) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { name: 'Administrador', role: 'admin' },
      app_metadata: { role: 'admin' },
    })
    if (error) throw error
    admin = data.user
    console.log(`Creado administrador: ${adminEmail}`)
  } else {
    const { error } = await supabase.auth.admin.updateUserById(admin.id, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: { ...admin.user_metadata, name: admin.user_metadata?.name || 'Administrador', role: 'admin' },
      app_metadata: { ...admin.app_metadata, role: 'admin' },
    })
    if (error) throw error
    console.log(`Actualizado administrador: ${adminEmail}`)
  }

  const remaining = await listAllUsers()
  console.log(`\nListo. Usuarios restantes: ${remaining.length}`)
  remaining.forEach(u => console.log(`  - ${u.email} (${u.user_metadata?.role || 'user'})`))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
