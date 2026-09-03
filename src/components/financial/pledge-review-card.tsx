'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Pledge, FinancialAccount } from '@/types/database'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Check, X, ExternalLink, MessageCircle, Ban } from 'lucide-react'
import { PLEDGE_ARCHIVE_DAYS, addDays } from '@/lib/financial/pledge-windows'

const METHOD_LABEL: Record<string, string> = { pix: 'Pix', paypal: 'PayPal', wise: 'Wise', bank_transfer: 'Transferência', other: 'Outro' }
const ANONYMOUS_LABEL = 'Apoiador anônimo'

interface Props {
  pledge: Pledge & { highlight?: { title: string } | null }
  accounts: FinancialAccount[]
  profileId: string
  budgetCategories: { id: string; label: string }[]
}

export function PledgeReviewCard({ pledge, accounts, profileId, budgetCategories }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState(String(pledge.reported_amount))
  // Só contas na mesma moeda da oferta aparecem no seletor — evita depositar
  // sem querer numa conta de outra moeda. Some pra lista completa se, por
  // algum motivo, não existir nenhuma conta ativa nessa moeda.
  const accountsInCurrency = accounts.filter(a => a.currency_code === pledge.currency)
  const accountOptions = accountsInCurrency.length > 0 ? accountsInCurrency : accounts
  const [accountId, setAccountId] = useState(accountOptions[0]?.id ?? '')
  // Pré-preenchido com a categoria que o apoiador escolheu ao contribuir —
  // o missionário confirma ou corrige antes de gerar o lançamento.
  const [categoryId, setCategoryId] = useState(pledge.budget_category_id ?? '')
  const { pendingValue: saving, run } = usePendingAction<'confirm' | 'reject'>()
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  function handleConfirm() {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { toast.error('Valor inválido.'); return }
    run('confirm', async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // 0. Sem nenhuma conta ainda: cria uma automaticamente a partir do
      // método de pagamento da própria oferta (ex.: "Conta Pix", na moeda
      // da oferta) — o usuário já disse "recebo por Pix" em Configurações,
      // não faz sentido pedir esse dado de novo antes de poder confirmar.
      let depositAccountId = accountId
      if (!depositAccountId) {
        const { data: newAccount, error: accountError } = await supabase.from('financial_accounts').insert({
          profile_id: profileId,
          name: `Conta ${METHOD_LABEL[pledge.payment_method] ?? 'Principal'}`,
          currency_code: pledge.currency,
          created_by_user_id: user!.id,
        }).select('id').single()
        if (accountError || !newAccount) { toast.error('Erro ao criar conta financeira.'); return }
        depositAccountId = newAccount.id
      }

      // 1. Encontra ou promove o parceiro
      let partnerId: string | null = pledge.partner_id
      if (!partnerId && pledge.reporter_user_id) {
        const { data: existing } = await supabase.from('partners').select('id').eq('profile_id', profileId).eq('user_id', pledge.reporter_user_id).maybeSingle()
        if (existing) partnerId = existing.id
        else {
          const { data: created } = await supabase.from('partners').insert({
            profile_id: profileId,
            user_id: pledge.reporter_user_id,
            name: pledge.reporter_name || ANONYMOUS_LABEL,
            email: pledge.reporter_email,
            type: 'financial',
          }).select('id').single()
          partnerId = created?.id ?? null
        }
      }

      // 2. Cria a transação real
      const { data: transaction, error: txError } = await supabase.from('transactions').insert({
        account_id: depositAccountId,
        profile_id: profileId,
        created_by_user_id: user!.id,
        type: 'income',
        amount: parsed,
        currency: pledge.currency,
        description: `Oferta de ${pledge.reporter_name || ANONYMOUS_LABEL}`,
        partner_id: partnerId,
        highlight_id: pledge.highlight_id,
        budget_category_id: categoryId || null,
        source: 'manual',
        date: pledge.reported_at.slice(0, 10),
      }).select('id').single()

      if (txError || !transaction) { toast.error('Erro ao criar lançamento.'); return }

      // 3. Marca o pledge como confirmado
      const { error: pledgeError } = await supabase.from('pledges').update({
        status: 'confirmed',
        reported_amount: parsed,
        partner_id: partnerId,
        confirmed_transaction_id: transaction.id,
        reviewed_by_user_id: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', pledge.id)

      if (pledgeError) { toast.error('Erro ao confirmar oferta.'); return }
      toast.success(accountId ? 'Oferta confirmada!' : `Conta "Conta ${METHOD_LABEL[pledge.payment_method] ?? 'Principal'}" criada e oferta confirmada!`)
      router.refresh()
    })
  }

  function handleReject() {
    run('reject', async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('pledges').update({
        status: 'rejected',
        rejection_reason: rejectReason.trim() || null,
        reviewed_by_user_id: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', pledge.id)
      if (error) { toast.error('Erro ao rejeitar.'); return }
      toast.success('Oferta rejeitada.')
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{pledge.reporter_name || ANONYMOUS_LABEL}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(pledge.reported_at)} · {METHOD_LABEL[pledge.payment_method]}
            {pledge.highlight?.title && ` · ${pledge.highlight.title}`}
            {pledge.is_recurring_pledge && ' · Parceiro fixo'}
          </p>
        </div>
        <p className="text-lg font-semibold shrink-0">{formatCurrency(pledge.reported_amount, pledge.currency)}</p>
      </div>

      {pledge.message && (
        <p className="text-xs bg-muted rounded-lg px-2.5 py-1.5 whitespace-pre-wrap">{pledge.message}</p>
      )}

      {pledge.status === 'rejected' && pledge.reviewed_at && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" /> Recusada em {formatDate(pledge.reviewed_at)}
          </p>
          {pledge.rejection_reason && <p className="text-xs text-foreground">{pledge.rejection_reason}</p>}
          <p className="text-xs text-muted-foreground">
            Ainda dá pra reconsiderar e confirmar até {formatDate(addDays(pledge.reviewed_at, PLEDGE_ARCHIVE_DAYS).toISOString())}.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {pledge.proof_url && (
          <a href={pledge.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Ver comprovante <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {pledge.reporter_phone && (
          <a href={`https://wa.me/${pledge.reporter_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> {pledge.reporter_phone}
          </a>
        )}
      </div>

      <div className="rounded-lg border bg-background/60 p-3 space-y-2.5">
        <p className="text-xs font-medium text-muted-foreground">Confirmar depósito</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs font-normal text-muted-foreground">Valor recebido</Label>
            <Input inputMode="decimal" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-normal text-muted-foreground">Depositar em</Label>
            {accounts.length > 0 ? (
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}{accountOptions === accounts ? ` (${a.currency_code})` : ''}</option>)}
              </select>
            ) : (
              <p className="h-8 flex items-center rounded-lg border border-dashed px-2.5 text-xs text-muted-foreground truncate">
                Nova: Conta {METHOD_LABEL[pledge.payment_method] ?? 'Principal'}
              </p>
            )}
          </div>
        </div>

        {accounts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Você ainda não tem nenhuma conta financeira — ao confirmar, criamos uma automaticamente com base no método desta oferta ({METHOD_LABEL[pledge.payment_method] ?? 'Outro'}, {pledge.currency}).{' '}
            <Link href="/dashboard/financeiro/contas" className="underline">Gerenciar contas</Link>
          </p>
        )}

        {budgetCategories.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs font-normal text-muted-foreground">Categoria do orçamento</Label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
              <option value="">Projeto geral</option>
              {budgetCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {pledge.status === 'pending' && showReject ? (
        <div className="space-y-2">
          <Input value={rejectReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)} placeholder="Motivo (o apoiador recebe essa observação)" className="h-8 text-sm" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowReject(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={handleReject} disabled={saving === 'reject'}>
              {saving === 'reject' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirmar rejeição
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {pledge.status === 'pending' && (
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setShowReject(true)}>
              <X className="h-3.5 w-3.5" /> Rejeitar
            </Button>
          )}
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleConfirm} disabled={saving === 'confirm'}>
            {saving === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Confirmar
          </Button>
        </div>
      )}
    </div>
  )
}
