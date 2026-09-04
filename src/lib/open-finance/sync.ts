import type PluggyClient from 'pluggy-js'
import type { Account as PluggyAccount } from 'pluggy-js'
import { createServiceClient } from '@/lib/supabase/server'
import { getPluggyClient } from './pluggy'
import { AccountType } from '@/types/database'

const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  CHECKINGS_ACCOUNT: 'checking',
  SAVINGS_ACCOUNT: 'savings',
  CREDIT_CARD: 'credit',
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function withBufferISO(isoDate: string, bufferDays: number) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() - bufferDays)
  return d.toISOString().slice(0, 10)
}

// Mesma lógica de `defaultFaturaDate()` em transaction-form.tsx (não
// exportada de lá — pequena o bastante pra duplicar, mesma convenção já
// usada por addOneMonth() nos crons de recorrência).
function defaultFaturaDate(purchaseDateISO: string, closingDay: number | null) {
  const d = new Date(`${purchaseDateISO}T00:00:00`)
  const offset = d.getDate() >= (closingDay ?? 1) ? 1 : 0
  const fd = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  return `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-01`
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ItemRow = any

async function syncTransactions(
  supabase: ServiceClient,
  pluggy: PluggyClient,
  itemRow: ItemRow,
  account: PluggyAccount,
  financialAccountId: string,
  isCredit: boolean,
  closingDay: number | null
) {
  const from = itemRow.last_synced_at ? withBufferISO(itemRow.last_synced_at, 3) : daysAgoISO(90)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = []
  let page = 1
  let totalPages = 1
  do {
    const resp = await pluggy.fetchTransactions(account.id, { from, page, pageSize: 500 })
    totalPages = resp.totalPages || 1
    for (const t of resp.results) {
      const dateISO = new Date(t.date).toISOString().slice(0, 10)
      const type = isCredit ? (t.amount < 0 ? 'income' : 'expense') : (t.amount >= 0 ? 'income' : 'expense')
      rows.push({
        account_id: financialAccountId,
        profile_id: itemRow.profile_id,
        created_by_user_id: null,
        type,
        amount: Math.abs(t.amount),
        currency: t.currencyCode,
        description: t.description || 'Transação Open Finance',
        source: 'open_finance',
        is_paid: true,
        is_credit_purchase: isCredit,
        fatura_date: isCredit ? defaultFaturaDate(dateISO, closingDay) : null,
        pluggy_transaction_id: t.id,
        date: dateISO,
      })
    }
    page++
  } while (page <= totalPages)

  if (rows.length > 0) {
    const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'pluggy_transaction_id' })
    if (error) throw new Error(`Falha ao importar transações da conta ${account.id}: ${error.message}`)
  }
}

async function syncAccount(supabase: ServiceClient, pluggy: PluggyClient, itemRow: ItemRow, account: PluggyAccount) {
  const accountType = ACCOUNT_TYPE_MAP[account.subtype] ?? 'checking'
  const isCredit = accountType === 'credit'
  const closingDay = isCredit && account.creditData?.balanceCloseDate ? new Date(account.creditData.balanceCloseDate).getDate() : null
  const dueDay = isCredit && account.creditData?.balanceDueDate ? new Date(account.creditData.balanceDueDate).getDate() : null

  const { data: existingLink } = await supabase
    .from('open_finance_accounts')
    .select('financial_account_id')
    .eq('pluggy_account_id', account.id)
    .maybeSingle()

  let financialAccountId: string

  if (existingLink) {
    financialAccountId = existingLink.financial_account_id
    // Só atualiza campos "administrados" pela Pluggy — nunca o nome, que o
    // usuário pode ter personalizado depois de criada.
    if (isCredit) {
      await supabase.from('financial_accounts').update({
        credit_limit: account.creditData?.creditLimit ?? null,
        card_brand: account.creditData?.brand ?? null,
        closing_day: closingDay,
        due_day: dueDay,
      }).eq('id', financialAccountId)
    }
  } else {
    const { data: created, error } = await supabase.from('financial_accounts').insert({
      profile_id: itemRow.profile_id,
      name: account.name || account.marketingName || 'Conta Open Finance',
      currency_code: account.currencyCode,
      account_type: accountType,
      balance: isCredit ? 0 : account.balance,
      credit_limit: isCredit ? (account.creditData?.creditLimit ?? null) : null,
      card_brand: isCredit ? (account.creditData?.brand ?? null) : null,
      closing_day: closingDay,
      due_day: dueDay,
      is_shared: false,
      created_by_user_id: itemRow.created_by_user_id,
      is_open_finance: true,
    }).select('id').single()
    if (error || !created) throw new Error(`Falha ao criar conta pra ${account.id}: ${error?.message}`)
    financialAccountId = created.id

    await supabase.from('open_finance_accounts').insert({
      item_id: itemRow.id,
      financial_account_id: financialAccountId,
      pluggy_account_id: account.id,
      pluggy_type: account.type,
    })
  }

  await syncTransactions(supabase, pluggy, itemRow, account, financialAccountId, isCredit, closingDay)

  // Reconciliação final: sobrescreve o saldo com o valor real da Pluggy.
  // Seguro pq é um UPDATE direto em financial_accounts (não em
  // transactions), então não recursiona no trigger update_account_balance()
  // — corrige qualquer deriva de arredondamento/transação não capturada.
  // Contas de crédito ficam com balance=0, mesma convenção das contas
  // manuais (fatura é somada a partir de transactions com fatura_paid=false).
  if (!isCredit) {
    await supabase.from('financial_accounts').update({ balance: account.balance }).eq('id', financialAccountId)
  }
}

// Sincroniza um item (conexão bancária) já registrado: busca o status e as
// contas atuais na Pluggy, cria/atualiza as `financial_accounts` vinculadas
// e importa lançamentos novos. Chamado por POST /api/open-finance/items
// (primeira sincronização), POST .../sync (botão "Sincronizar agora"), pelo
// webhook (evento item/updated) e pelo cron diário — mesma função pros 4
// caminhos, pra nunca divergir o que "sincronizar" significa.
export async function syncOpenFinanceItem(itemRowId: string): Promise<{ status: string }> {
  const supabase = await createServiceClient()
  const { data: itemRow } = await supabase.from('open_finance_items').select('*').eq('id', itemRowId).single()
  if (!itemRow) throw new Error('open_finance_items não encontrado')

  const pluggy = await getPluggyClient()
  const item = await pluggy.fetchItem(itemRow.pluggy_item_id)

  await supabase.from('open_finance_items').update({
    status: item.status,
    connector_id: item.connector.id,
    connector_name: item.connector.name,
    connector_image_url: item.connector.imageUrl,
  }).eq('id', itemRowId)

  // LOGIN_ERROR/WAITING_USER_INPUT: credenciais expiraram ou precisa de MFA
  // — nada novo pra buscar até o usuário reconectar pelo widget.
  if (item.status === 'LOGIN_ERROR' || item.status === 'WAITING_USER_INPUT') {
    return { status: item.status }
  }

  const { results: accounts } = await pluggy.fetchAccounts(itemRow.pluggy_item_id)

  for (const account of accounts) {
    try {
      await syncAccount(supabase, pluggy, itemRow, account)
    } catch (err) {
      console.error(`[open-finance] falha ao sincronizar conta ${account.id} do item ${itemRow.id}:`, err)
    }
  }

  await supabase.from('open_finance_items').update({ last_synced_at: new Date().toISOString() }).eq('id', itemRowId)

  return { status: item.status }
}
