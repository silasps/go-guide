import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { AccountsList } from '@/components/financial/accounts-list'
import { syncCardInvoices, type PendingInvoicePayment } from '@/lib/financial/card-invoices-sync'
import { Button } from '@/components/ui/button'
import { Landmark, Settings2 } from 'lucide-react'

// Botão "Gerenciar Open Finance" desativado de propósito (custo do agregador
// Pluggy inviável nesta fase do produto — decisão do usuário, ver
// system.architecture.md 7.33). A integração inteira (schema, rotas, sync,
// widget — seção 7.32) continua no repo, pronta pra reativar bastando trocar
// este botão de volta pelo <OpenFinanceManageDialog>.
export default async function ContasPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()
  const { data: { user } } = await supabase.auth.getUser()
  await syncCardInvoices(supabase, profile!.id, user!.id)

  const { data: accounts } = await supabase.from('financial_accounts').select('*').order('created_at')
  const accountIds = (accounts ?? []).map(a => a.id)
  const { data: members } = accountIds.length > 0
    ? await supabase.from('account_members').select('*').in('account_id', accountIds)
    : { data: [] }

  // Só despesa conta como fatura: a perna de entrada do pagamento (no cartão)
  // é transferência e não pode somar na dívida de novo.
  const creditAccountIds = (accounts ?? []).filter(a => a.account_type === 'credit').map(a => a.id)
  const { data: openBills } = creditAccountIds.length > 0
    ? await supabase.from('transactions').select('account_id, amount').in('account_id', creditAccountIds).eq('type', 'expense').eq('fatura_paid', false)
    : { data: [] }
  const currentBills: Record<string, number> = {}
  for (const t of openBills ?? []) {
    currentBills[t.account_id] = (currentBills[t.account_id] ?? 0) + t.amount
  }

  const { data: pendingRows } = creditAccountIds.length > 0
    ? await supabase
        .from('transactions')
        .select('id, account_id, amount, date, transfer_group_id, card_invoice_account_id, card_invoice_fatura_date')
        .in('card_invoice_account_id', creditAccountIds)
        .eq('transfer_direction', 'out')
        .eq('is_paid', false)
        .order('date')
    : { data: [] }
  const pendingPayments: Record<string, PendingInvoicePayment[]> = {}
  for (const r of pendingRows ?? []) {
    if (!r.card_invoice_account_id || !r.transfer_group_id || !r.card_invoice_fatura_date) continue
    const item: PendingInvoicePayment = { ...r, amount: Number(r.amount), transfer_group_id: r.transfer_group_id, card_invoice_account_id: r.card_invoice_account_id, card_invoice_fatura_date: r.card_invoice_fatura_date }
    ;(pendingPayments[r.card_invoice_account_id] ??= []).push(item)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Landmark className="h-6 w-6" /> Contas bancárias
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Acompanhe saldos, responsáveis e conexões bancárias em um só lugar.</p>
        </div>
        <Button variant="outline" className="gap-2" disabled title="Em breve">
          <Settings2 className="h-4 w-4" /> Gerenciar Open Finance
        </Button>
      </div>
      <AccountsList profileId={profile!.id} accounts={accounts ?? []} members={members ?? []} currentBills={currentBills} pendingPayments={pendingPayments} />
    </div>
  )
}
