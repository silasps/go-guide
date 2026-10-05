import type { SupabaseClient } from '@supabase/supabase-js'
import { planInvoiceSync, type InvoiceLine, type InvoicePaymentRow } from './card-invoices'

export interface PendingInvoicePayment {
  id: string
  account_id: string
  amount: number
  date: string
  transfer_group_id: string
  card_invoice_account_id: string
  card_invoice_fatura_date: string
}

const SYNC_FIELDS = 'id, account_id, type, amount, currency, is_paid, fatura_date, fatura_paid, card_invoice_account_id, card_invoice_fatura_date, transfer_group_id, transfer_direction, date'

function formatBrDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Mantém um pagamento previsto por fatura de cada cartão: cria quando surge
// fatura nova, atualiza enquanto ela não foi paga, apaga se não sobrar nada.
// Roda ao abrir as telas de Financeiro/Contas — idempotente, então rodar
// várias vezes não duplica nada (o índice único do banco também barra).
export async function syncCardInvoices(supabase: SupabaseClient, profileId: string, userId: string): Promise<void> {
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('id, name, currency_code, account_type, closing_day, due_day, paid_from_account_id, archived')
    .eq('profile_id', profileId)
    .eq('archived', false)
  const list = accounts ?? []
  const cards = list.filter((a) => a.account_type === 'credit' && a.closing_day && a.due_day)
  if (cards.length === 0) return
  const checkings = list.filter((a) => a.account_type === 'checking')

  const { data: rows } = await supabase
    .from('transactions')
    .select(SYNC_FIELDS)
    .eq('profile_id', profileId)
    .in('type', ['expense', 'transfer'])
  const txs = rows ?? []

  for (const card of cards) {
    const checkingId = card.paid_from_account_id ?? checkings.find((c) => c.currency_code === card.currency_code)?.id ?? null
    const lines: InvoiceLine[] = txs
      .filter((t) => t.account_id === card.id)
      .map((t) => ({ id: t.id, account_id: t.account_id, type: t.type, amount: Number(t.amount), is_paid: t.is_paid, fatura_date: t.fatura_date, fatura_paid: t.fatura_paid }))
    const payments: InvoicePaymentRow[] = txs
      .filter((t) => t.card_invoice_account_id === card.id)
      .map((t) => ({ id: t.id, account_id: t.account_id, transfer_group_id: t.transfer_group_id, card_invoice_fatura_date: t.card_invoice_fatura_date, card_invoice_account_id: t.card_invoice_account_id, amount: Number(t.amount), is_paid: t.is_paid, date: t.date }))

    const actions = planInvoiceSync({ id: card.id, closing_day: card.closing_day, due_day: card.due_day }, lines, payments, checkingId)

    for (const action of actions) {
      if (action.kind === 'create') {
        const gid = crypto.randomUUID()
        const description = `Pagamento fatura ${card.name} — venc. ${formatBrDate(action.dueDate)}`
        // A perna da corrente vem primeiro: se já existir pagamento dessa fatura
        // o índice único recusa, e a perna do cartão nem é criada.
        const { error } = await supabase.from('transactions').insert({
          account_id: action.checkingId,
          profile_id: profileId,
          created_by_user_id: userId,
          type: 'transfer',
          transfer_direction: 'out',
          transfer_account_id: card.id,
          transfer_group_id: gid,
          amount: action.amount,
          currency: card.currency_code,
          description,
          source: 'manual',
          is_paid: false,
          date: action.dueDate,
          card_invoice_account_id: card.id,
          card_invoice_fatura_date: action.faturaDate,
        })
        if (error) continue
        await supabase.from('transactions').insert({
          account_id: card.id,
          profile_id: profileId,
          created_by_user_id: userId,
          type: 'transfer',
          transfer_direction: 'in',
          transfer_account_id: action.checkingId,
          transfer_group_id: gid,
          amount: action.amount,
          currency: card.currency_code,
          description,
          source: 'manual',
          is_paid: false,
          date: action.dueDate,
        })
      } else if (action.kind === 'update') {
        await supabase.from('transactions').update({ amount: action.amount }).eq('transfer_group_id', action.transferGroupId)
      } else {
        await supabase.from('transactions').delete().eq('transfer_group_id', action.transferGroupId)
      }
    }
  }
}

// "Confirmar pagamento": a fatura foi debitada de verdade. Marca as duas
// pernas da transferência como pagas e fecha as compras daquela fatura.
export async function confirmInvoicePayment(supabase: SupabaseClient, payment: PendingInvoicePayment): Promise<string | null> {
  const { error: legsError } = await supabase
    .from('transactions')
    .update({ is_paid: true })
    .eq('transfer_group_id', payment.transfer_group_id)
  if (legsError) return legsError.message

  const { error: linesError } = await supabase
    .from('transactions')
    .update({ is_paid: true, fatura_paid: true })
    .eq('account_id', payment.card_invoice_account_id)
    .eq('type', 'expense')
    .eq('fatura_date', payment.card_invoice_fatura_date)
    .eq('fatura_paid', false)
  return linesError?.message ?? null
}
