'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
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
  sourceAccount: FinancialAccount
  accounts: FinancialAccount[]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// "Transferir" (estilo GranaZen, ver system.architecture.md 7.29) — o
// `type = 'transfer'` já existia em `transactions` mas nunca teve efeito
// real (sem conta de destino, sem branch no trigger de saldo — ver
// migration 102). Cada transferência vira duas linhas ligadas por
// `transfer_group_id`: uma 'out' na conta de origem, uma 'in' na conta de
// destino, `amount` sempre positivo (sinal vem de `transfer_direction`,
// não do valor). Só entre contas não-crédito da mesma moeda — cruzar
// moeda exigiria conversão, fora de escopo aqui.
export function TransferDialog({ open, onOpenChange, sourceAccount, accounts }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const eligible = accounts.filter((a) => a.id !== sourceAccount.id && a.account_type !== 'credit' && !a.archived && a.currency_code === sourceAccount.currency_code)
  const [destinationId, setDestinationId] = useState(eligible[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayISO())

  const parsedAmount = parseFloat(fromMasked(amount, sourceAccount.currency_code)) || 0
  const destination = eligible.find((a) => a.id === destinationId)

  function save() {
    if (!destination) { toast.error('Selecione a conta de destino.'); return }
    if (parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }

    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const transferGroupId = crypto.randomUUID()
      const desc = description.trim() || 'Transferência'

      const { error } = await supabase.from('transactions').insert([
        {
          account_id: sourceAccount.id,
          profile_id: sourceAccount.profile_id,
          created_by_user_id: user!.id,
          type: 'transfer',
          amount: parsedAmount,
          currency: sourceAccount.currency_code,
          description: desc,
          source: 'manual',
          is_paid: true,
          date,
          transfer_group_id: transferGroupId,
          transfer_direction: 'out',
          transfer_account_id: destination.id,
        },
        {
          account_id: destination.id,
          profile_id: destination.profile_id,
          created_by_user_id: user!.id,
          type: 'transfer',
          amount: parsedAmount,
          currency: destination.currency_code,
          description: desc,
          source: 'manual',
          is_paid: true,
          date,
          transfer_group_id: transferGroupId,
          transfer_direction: 'in',
          transfer_account_id: sourceAccount.id,
        },
      ])
      if (error) { toast.error('Erro ao transferir.'); return }
      toast.success('Transferência feita.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Transferir</DialogTitle>
          <DialogDescription>Move dinheiro de {sourceAccount.name} pra outra conta sua.</DialogDescription>
        </DialogHeader>

        {eligible.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Crie outra conta corrente ou poupança em {sourceAccount.currency_code} pra transferir.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Conta de destino</Label>
              <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                {eligible.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input autoFocus inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, sourceAccount.currency_code))} placeholder="0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} placeholder="Transferência" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" max={todayISO()} value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {eligible.length > 0 && (
            <Button type="button" disabled={saving} onClick={save} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Transferir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
