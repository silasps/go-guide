// Script de uso único: recalcula de verdade o financial_snapshot de UM
// broadcast específico já existente, a partir das transactions reais do
// período — só pra poder ver o redesign da prestação de contas funcionando
// num relatório que já existe, sem esperar criar um novo.
//
// Achado ao rodar pela primeira vez: o broadcast alvo tinha
// incomeByCurrency/expenseByCurrency/topExpenseCategories TODOS vazios —
// não por falta de dado real, mas por um bug de verdade em
// `POST /api/ai/generate-partner-update` (embed `transaction_categories(name)`
// ambíguo porque `transactions` tem duas FKs pra essa tabela — category_id
// E subcategory_id — então o PostgREST recusa o embed implícito; o código
// só lia `data`, nunca `error`, então a lista virava `[]` em silêncio e o
// financeiro inteiro saía zerado). Corrigido na rota com o hint
// `transaction_categories!category_id(name)` (ver system.architecture.md
// 7.10-quinquies) — este script usa a mesma correção e recalcula tudo do
// zero a partir da tabela `transactions` real, em vez de só remendar os
// campos novos (periodFrom/periodTo/count/firstDate/lastDate) em cima de
// um snapshot que nunca teve os valores certos.
//
// Não mexe em nenhum outro broadcast. Reversível: só reescreve
// financial_snapshot/highlight_ids da própria linha.
//
// Uso: node --env-file=.env.local scripts/_backfill-broadcast-period.mjs <broadcastId>

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com: node --env-file=.env.local scripts/_backfill-broadcast-period.mjs <broadcastId>')
  process.exit(1)
}

const BROADCAST_ID = process.argv[2]
if (!BROADCAST_ID) {
  console.error('Uso: node --env-file=.env.local scripts/_backfill-broadcast-period.mjs <broadcastId>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

function iso(d) { return d.toISOString().slice(0, 10) }

const { data: broadcast, error: fetchErr } = await supabase
  .from('partner_broadcasts')
  .select('id, profile_id, subject, financial_snapshot, financial_visibility, highlight_ids, created_at')
  .eq('id', BROADCAST_ID)
  .single()
if (fetchErr) { console.error('Erro ao buscar broadcast:', fetchErr.message); process.exit(1) }

console.log(`--- ${broadcast.subject} (criado em ${broadcast.created_at}) ---`)

const financial = broadcast.financial_snapshot
if (!financial) { console.error('Este broadcast não tem financial_snapshot — nada a fazer.'); process.exit(1) }

const days = /90/.test(financial.periodLabel ?? '') ? 90 : 30
const to = new Date(broadcast.created_at)
const from = new Date(to)
from.setDate(from.getDate() - days)
const periodFrom = iso(from)
const periodTo = iso(to)
console.log(`Período inferido de "${financial.periodLabel}": ${periodFrom} → ${periodTo}`)

// Mesma lógica de agregação de src/app/api/ai/generate-partner-update/route.ts,
// já com o hint `!category_id` que corrige a ambiguidade de embed.
const { data: transactions, error: txErr } = await supabase
  .from('transactions')
  .select('type, amount, currency, date, category_id, transaction_categories!category_id(name)')
  .eq('profile_id', broadcast.profile_id)
  .in('type', ['income', 'expense'])
  .gte('date', periodFrom)
  .lte('date', periodTo)
if (txErr) { console.error('Erro ao buscar transactions:', txErr.message); process.exit(1) }

const incomeByCurrency = {}
const expenseByCurrency = {}
const expenseByCategory = new Map()

for (const t of transactions ?? []) {
  const target = t.type === 'income' ? incomeByCurrency : expenseByCurrency
  target[t.currency] = (target[t.currency] ?? 0) + Number(t.amount)

  if (t.type === 'expense' && t.category_id) {
    const category = Array.isArray(t.transaction_categories) ? t.transaction_categories[0] : t.transaction_categories
    const name = category?.name ?? 'Outros'
    const key = `${name}:${t.currency}`
    const existing = expenseByCategory.get(key)
    expenseByCategory.set(key, {
      name,
      currency: t.currency,
      amount: (existing?.amount ?? 0) + Number(t.amount),
      count: (existing?.count ?? 0) + 1,
      firstDate: existing?.firstDate && existing.firstDate < t.date ? existing.firstDate : t.date,
      lastDate: existing?.lastDate && existing.lastDate > t.date ? existing.lastDate : t.date,
    })
  }
}

const topExpenseCategories = [...expenseByCategory.values()].sort((a, b) => b.amount - a.amount).slice(0, 3)

const newFinancial = { periodLabel: financial.periodLabel, periodFrom, periodTo, incomeByCurrency, expenseByCurrency, topExpenseCategories }
console.log('Recalculado:', JSON.stringify(newFinancial, null, 2))

// Projetos automáticos em modo report (mudança desta rodada): se o
// broadcast não tem nenhum projeto vinculado ainda, inclui os ativos do
// profile — mesmo critério de `activeHighlights` em parceiros/page.tsx.
let highlightIds = broadcast.highlight_ids ?? []
if (highlightIds.length === 0) {
  const { data: activeHighlights } = await supabase
    .from('highlights')
    .select('id, title')
    .eq('profile_id', broadcast.profile_id)
    .eq('status', 'active')
    .is('archived_at', null)
  if (activeHighlights?.length) {
    highlightIds = activeHighlights.map((h) => h.id)
    console.log(`✓ ${activeHighlights.length} projeto(s) ativo(s) vinculado(s): ${activeHighlights.map((h) => h.title).join(', ')}`)
  }
}

const { error: updateErr } = await supabase
  .from('partner_broadcasts')
  .update({ financial_snapshot: newFinancial, highlight_ids: highlightIds })
  .eq('id', BROADCAST_ID)
if (updateErr) { console.error('Erro ao salvar:', updateErr.message); process.exit(1) }

console.log('✓ financial_snapshot recalculado com dado real (antes estava zerado pelo bug do embed ambíguo)')

// Só pra avisar o que vai (ou não vai) aparecer na página — não cria dado
// nenhum, só relata o que já existe de verdade nesse período.
const { count: postsCount } = await supabase
  .from('posts')
  .select('*', { count: 'exact', head: true })
  .eq('profile_id', broadcast.profile_id)
  .eq('is_draft', false)
  .neq('moderation_status', 'removed')
  .in('type', ['image', 'carousel'])
  .gte('published_at', periodFrom)
  .lte('published_at', `${periodTo}T23:59:59`)

const { count: milestonesCount } = await supabase
  .from('milestones')
  .select('*', { count: 'exact', head: true })
  .eq('profile_id', broadcast.profile_id)
  .eq('is_completed', true)
  .gte('completed_at', periodFrom)
  .lte('completed_at', `${periodTo}T23:59:59`)

console.log(`Posts com imagem no período: ${postsCount ?? 0} ${postsCount ? '(galeria vai aparecer)' : '(sem galeria — nenhum post com imagem nessa janela)'}`)
console.log(`Marcos concluídos no período: ${milestonesCount ?? 0} ${milestonesCount ? '(timeline vai aparecer)' : '(sem timeline — nenhum marco concluído nessa janela)'}`)
