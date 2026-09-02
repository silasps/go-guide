'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { FinancialAccount, TransactionCategory, RecurringTransaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurring?: RecurringTransaction
  accounts: FinancialAccount[]
  categories?: TransactionCategory[]
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

// Mesmo shape de transaction-form.tsx, sem os campos específicos de
// lançamento pontual (parceiro/projeto/fatura) — recorrência é conta fixa
// pessoal (aluguel, assinatura), não fundraising. "Próxima ocorrência" no
// lugar de "Data": o cron (generate-recurring-transactions) avança esse
// campo em +1 mês a cada geração.
export function RecurringTransactionForm({ open, onOpenChange, recurring, accounts, categories = [], trigger }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [type, setType] = useState<'income' | 'expense'>(recurring?.type ?? 'expense')
  const [amount, setAmount] = useState(recurring ? toMasked(String(Math.round(recurring.amount * 100))) : '')
  const [description, setDescription] = useState(recurring?.description ?? '')
  const [accountId, setAccountId] = useState(recurring?.account_id ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(recurring?.category_id ?? '')
  const [nextDueDate, setNextDueDate] = useState(recurring?.next_due_date ?? new Date().toISOString().slice(0, 10))

  const topCategories = categories.filter(c => !c.parent_id)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount))
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }
    if (!description.trim()) { toast.error('Descrição obrigatória.'); return }
    const account = accounts.find(a => a.id === accountId)
    if (!account) { toast.error('Selecione uma conta.'); return }

    run(true, async () => {
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
        next_due_date: nextDueDate,
      }

      const { error } = recurring
        ? await supabase.from('recurring_transactions').update(payload).eq('id', recurring.id)
        : await supabase.from('recurring_transactions').insert({ ...payload, created_by_user_id: user!.id })

      if (error) { toast.error('Erro ao salvar recorrência.'); return }
      toast.success(recurring ? 'Recorrência atualizada.' : 'Recorrência criada.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{recurring ? 'Editar recorrência' : 'Nova recorrência'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'income', label: '💰 Entrada' },
              { value: 'expense', label: '💸 Saída' },
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
            <Input value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} placeholder="Ex: Aluguel" required />
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
              <Label>Próxima ocorrência</Label>
              <Input type="date" value={nextDueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNextDueDate(e.target.value)} required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Repete todo mês nesse dia — sem opção de outra frequência por enquanto.</p>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {recurring ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
