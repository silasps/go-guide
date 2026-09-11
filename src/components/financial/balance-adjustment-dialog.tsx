'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency } from '@/lib/utils'
import { toMasked, fromMasked } from '@/lib/currency-mask'
import { FinancialAccount } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: FinancialAccount
}

// "Ajustar saldo" (estilo GranaZen, ver system.architecture.md 7.29) —
// corrige `financial_accounts.balance` pra um valor alvo lançando a
// diferença como uma transação normal (income/expense conforme o sinal do
// delta), mesmo mecanismo do saldo inicial (migration 095), só com
// `source: 'balance_adjustment'` pra distinguir a origem no histórico. Só
// pra contas não-crédito — saldo de cartão é a fatura calculada por
// transações não pagas, não a coluna `balance` (mesma restrição de
// `ImportStatementDialog`).
export function BalanceAdjustmentDialog({ open, onOpenChange, account }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [target, setTarget] = useState(toMasked(String(Math.round(Math.abs(account.balance) * 100)), account.currency_code))

  const parsedTarget = parseFloat(fromMasked(target, account.currency_code)) || 0
  const delta = Math.round((parsedTarget - account.balance) * 100) / 100

  function save() {
    if (delta === 0) { toast.info('Saldo já está correto.'); onOpenChange(false); return }
    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('transactions').insert({
        account_id: account.id,
        profile_id: account.profile_id,
        created_by_user_id: user!.id,
        type: delta > 0 ? 'income' : 'expense',
        amount: Math.abs(delta),
        currency: account.currency_code,
        description: 'Ajuste de saldo',
        source: 'balance_adjustment',
        is_paid: true,
        date: new Date().toISOString().slice(0, 10),
      })
      if (error) { toast.error('Erro ao ajustar saldo.'); return }
      toast.success('Saldo ajustado.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription>Corrige o saldo de {account.name} pra bater com o valor real da conta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Saldo atual: <span className="font-medium text-foreground">{formatCurrency(account.balance, account.currency_code)}</span>
          </p>
          <div className="space-y-2">
            <Label>Saldo correto</Label>
            <Input autoFocus inputMode="numeric" value={target} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarget(toMasked(e.target.value, account.currency_code))} placeholder="0,00" />
          </div>
          {delta !== 0 && (
            <p className="text-xs text-muted-foreground">
              Vai lançar {delta > 0 ? 'uma entrada' : 'uma saída'} de {formatCurrency(Math.abs(delta), account.currency_code)} pra fechar a diferença.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={saving} onClick={save} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ajustar saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
