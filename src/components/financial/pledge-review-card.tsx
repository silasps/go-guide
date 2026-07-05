'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Pledge, FinancialAccount } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Check, X, ExternalLink } from 'lucide-react'

const METHOD_LABEL: Record<string, string> = { pix: 'Pix', paypal: 'PayPal', wise: 'Wise', bank_transfer: 'Transferência', other: 'Outro' }

interface Props {
  pledge: Pledge & { highlight?: { title: string } | null }
  accounts: FinancialAccount[]
  profileId: string
}

export function PledgeReviewCard({ pledge, accounts, profileId }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState(String(pledge.reported_amount))
  const [accountId, setAccountId] = useState(accounts.find(a => a.currency_code === pledge.currency)?.id ?? accounts[0]?.id ?? '')
  const [saving, setSaving] = useState<'confirm' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function handleConfirm() {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { toast.error('Valor inválido.'); return }
    if (!accountId) { toast.error('Selecione uma conta para depositar.'); return }
    setSaving('confirm')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Encontra ou promove o parceiro
    let partnerId: string | null = pledge.partner_id
    if (!partnerId && pledge.reporter_user_id) {
      const { data: existing } = await supabase.from('partners').select('id').eq('profile_id', profileId).eq('user_id', pledge.reporter_user_id).maybeSingle()
      if (existing) partnerId = existing.id
      else {
        const { data: created } = await supabase.from('partners').insert({
          profile_id: profileId,
          user_id: pledge.reporter_user_id,
          name: pledge.reporter_name,
          email: pledge.reporter_email,
          type: 'financial',
        }).select('id').single()
        partnerId = created?.id ?? null
      }
    }

    // 2. Cria a transação real
    const { data: transaction, error: txError } = await supabase.from('transactions').insert({
      account_id: accountId,
      profile_id: profileId,
      created_by_user_id: user!.id,
      type: 'income',
      amount: parsed,
      currency: pledge.currency,
      description: `Oferta de ${pledge.reporter_name}`,
      partner_id: partnerId,
      highlight_id: pledge.highlight_id,
      source: 'manual',
      date: pledge.reported_at.slice(0, 10),
    }).select('id').single()

    if (txError || !transaction) { toast.error('Erro ao criar lançamento.'); setSaving(null); return }

    // 3. Marca o pledge como confirmado
    const { error: pledgeError } = await supabase.from('pledges').update({
      status: 'confirmed',
      reported_amount: parsed,
      partner_id: partnerId,
      confirmed_transaction_id: transaction.id,
      reviewed_by_user_id: user!.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', pledge.id)

    setSaving(null)
    if (pledgeError) { toast.error('Erro ao confirmar oferta.'); return }
    toast.success('Oferta confirmada!')
    router.refresh()
  }

  async function handleReject() {
    setSaving('reject')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('pledges').update({
      status: 'rejected',
      rejection_reason: rejectReason.trim() || null,
      reviewed_by_user_id: user!.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', pledge.id)
    setSaving(null)
    if (error) { toast.error('Erro ao rejeitar.'); return }
    toast.success('Oferta rejeitada.')
    router.refresh()
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{pledge.reporter_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(pledge.reported_at)} · {METHOD_LABEL[pledge.payment_method]}
            {pledge.highlight?.title && ` · ${pledge.highlight.title}`}
            {pledge.is_recurring_pledge && ' · Parceiro fixo'}
          </p>
        </div>
        <p className="text-lg font-semibold shrink-0">{formatCurrency(pledge.reported_amount, pledge.currency)}</p>
      </div>

      {pledge.proof_url && (
        <a href={pledge.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          Ver comprovante <ExternalLink className="h-3 w-3" />
        </a>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input inputMode="decimal" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} className="h-8 text-sm" />
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring">
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {showReject ? (
        <div className="space-y-2">
          <Input value={rejectReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)} placeholder="Motivo (opcional)" className="h-8 text-sm" />
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
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setShowReject(true)}>
            <X className="h-3.5 w-3.5" /> Rejeitar
          </Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleConfirm} disabled={saving === 'confirm' || !accountId}>
            {saving === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Confirmar
          </Button>
        </div>
      )}
    </div>
  )
}
