'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FinancialAccount, TransactionCategory, TransactionType, Partner, Transaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface HighlightOption { id: string; title: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction
  accounts: FinancialAccount[]
  categories?: TransactionCategory[]
  partners?: Partner[]
  highlights?: HighlightOption[]
  defaultHighlightId?: string
  trigger?: React.ReactNode
}

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

export function TransactionForm({ open, onOpenChange, transaction, accounts, categories = [], partners = [], highlights = [], defaultHighlightId, trigger }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'income')
  const [amount, setAmount] = useState(transaction ? toMasked(String(Math.round(transaction.amount * 100))) : '')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [accountId, setAccountId] = useState(transaction?.account_id ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '')
  const [partnerId, setPartnerId] = useState(transaction?.partner_id ?? '')
  const [highlightId, setHighlightId] = useState(transaction?.highlight_id ?? defaultHighlightId ?? '')
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10))

  const topCategories = categories.filter(c => !c.parent_id)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount))
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }
    if (!description.trim()) { toast.error('Descrição obrigatória.'); return }
    const account = accounts.find(a => a.id === accountId)
    if (!account) { toast.error('Selecione uma conta.'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      account_id: accountId,
      profile_id: account.profile_id,
      type,
      amount: parsedAmount,
      currency: account.currency_code,
      description: description.trim(),
      category_id: categoryId || null,
      partner_id: partnerId || null,
      highlight_id: highlightId || null,
      date,
    }

    const { error } = transaction
      ? await supabase.from('transactions').update(payload).eq('id', transaction.id)
      : await supabase.from('transactions').insert({ ...payload, created_by_user_id: user!.id })

    setSaving(false)
    if (error) { toast.error('Erro ao salvar lançamento.'); return }
    toast.success(transaction ? 'Lançamento atualizado.' : 'Lançamento criado.')
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'income', label: '💰 Entrada' },
              { value: 'expense', label: '💸 Saída' },
              { value: 'transfer', label: '🔁 Transf.' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`py-2 px-2 rounded-lg border text-xs transition-colors ${type === value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Conta</Label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value))} placeholder="0,00" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} placeholder="Ex: Oferta recebida" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                <option value="">Sem categoria</option>
                {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
            </div>
          </div>

          {partners.length > 0 && (
            <div className="space-y-2">
              <Label>Parceiro (opcional)</Label>
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                <option value="">Nenhum</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {highlights.length > 0 && (
            <div className="space-y-2">
              <Label>Projeto (opcional)</Label>
              <select value={highlightId} onChange={(e) => setHighlightId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                <option value="">Nenhum</option>
                {highlights.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transaction ? 'Salvar' : 'Lançar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
