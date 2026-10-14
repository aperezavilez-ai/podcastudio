import { execSync } from 'child_process'

const vars = [
  { name: 'VITE_SUPABASE_URL', value: 'https://fzoiuyyvzhgqcjceagkd.supabase.co' },
  { name: 'SUPABASE_URL', value: 'https://fzoiuyyvzhgqcjceagkd.supabase.co' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://fzoiuyyvzhgqcjceagkd.supabase.co' },
  { name: 'VITE_SUPABASE_ANON_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2l1eXl2emhncWNqY2VhZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMyOTUsImV4cCI6MjA5NzMwOTI5NX0.YQpOkEmgWHOTJgUnHp-EfWt68QW9xWTUxbvjzUtfU54' },
  { name: 'SUPABASE_ANON_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2l1eXl2emhncWNqY2VhZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMyOTUsImV4cCI6MjA5NzMwOTI5NX0.YQpOkEmgWHOTJgUnHp-EfWt68QW9xWTUxbvjzUtfU54' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2l1eXl2emhncWNqY2VhZ2tkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTczMzI5NSwiZXhwIjoyMDk3MzA5Mjk1fQ.WGUClZ6_PMm1ljokj1dBsciOKAbeBJ4ybuJrKbEF-6A' },
  { name: 'VITE_SUPABASE_PROJECT_ID', value: 'fzoiuyyvzhgqcjceagkd' },
  { name: 'SUPABASE_PUBLISHABLE_KEY', value: 'sb_publishable_5Eg99LktKnLTOvCYIxExeQ_5VzIPeSi' },
  { name: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: 'sb_publishable_5Eg99LktKnLTOvCYIxExeQ_5VzIPeSi' },
]

for (const v of vars) {
  try {
    console.log(`Setting ${v.name} in Vercel...`)
    const out = execSync(`npx vercel env add ${v.name} production,preview,development --value "${v.value}" --force --yes`, {
      encoding: 'utf8',
      stdio: 'pipe',
    })
    console.log(`✓ ${v.name} configured:`, out.trim())
  } catch (err) {
    console.error(`✗ Error on ${v.name}:`, err.stderr || err.message)
  }
}
console.log('Finished updating Vercel environment variables.')
