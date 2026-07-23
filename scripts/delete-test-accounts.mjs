// Apaga todas as contas de teste criadas por seed-test-accounts.mjs.
// Fonte da verdade é o e-mail terminando em @seed.goguide.test (não o
// manifesto JSON, que é só exibido como conferência) — funciona mesmo que
// o arquivo de manifesto tenha sido apagado ou esteja desatualizado.
// Apagar o auth.users de cada conta faz cascade em profiles e em tudo que
// pendura de profile_id (highlights, posts, payment_methods,
// financial_accounts, transactions, partners, pledges, recurring_pledges,
// follows) — não precisa apagar nada manualmente antes.
//
// Uso: node --env-file=.env.local scripts/delete-test-accounts.mjs

import { createClient } from '@supabase/supabase-js'
import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, 'seed-test-accounts.output.json')
const DOMAIN = '@seed.goguide.test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com: node --env-file=.env.local scripts/delete-test-accounts.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

try {
  const raw = await readFile(OUTPUT_PATH, 'utf-8')
  const roster = JSON.parse(raw)
  console.log('--- Manifesto encontrado, contas que devem ser apagadas ---')
  console.table(roster.map(({ persona, role, email }) => ({ persona, role, email })))
} catch {
  console.log('(sem manifesto local — seguindo só pela busca de e-mail @seed.goguide.test)')
}

console.log(`\n--- Buscando usuários com e-mail terminando em ${DOMAIN} ---`)

const toDelete = []
let page = 1
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error('✖ listar usuários:', error.message)
    process.exit(1)
  }
  toDelete.push(...data.users.filter((u) => u.email?.endsWith(DOMAIN)))
  if (data.users.length < 200) break
  page += 1
}

if (toDelete.length === 0) {
  console.log('Nenhuma conta de teste encontrada — nada para apagar.')
  process.exit(0)
}

console.log(`Encontradas ${toDelete.length} contas. Apagando...`)

let deleted = 0
for (const user of toDelete) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) {
    console.error(`✖ apagar ${user.email}:`, error.message)
    continue
  }
  deleted += 1
  console.log(`✓ ${user.email}`)
}

console.log(`\n${deleted}/${toDelete.length} contas apagadas (cascade removeu highlights/posts/pledges/follows/partners/financeiro relacionados).`)

await rm(OUTPUT_PATH, { force: true })
console.log(`Manifesto ${OUTPUT_PATH} removido.`)
