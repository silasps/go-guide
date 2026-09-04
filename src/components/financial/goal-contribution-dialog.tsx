'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { FinancialGoal } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: FinancialGoal
}

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

// Aporte manual — soma em `current_amount` (não lança em `transactions`,
// meta não tem vínculo automático com o caixa, ver migration 083).
export function GoalContributionDialog({ open, onOpenChange, goal }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [amount, setAmount] = useState('')

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parseFloat(fromMasked(amount))
    if (!parsed || parsed <= 0) { toast.error('Informe um valor válido.'); return }

    run(true, async () => {
      const supabase = createClient()
      const newAmount = goal.current_amount + parsed
      const payload = {
        current_amount: newAmount,
        achieved_at: !goal.achieved_at && newAmount >= goal.target_amount ? new Date().toISOString() : goal.achieved_at,
      }
      const { error } = await supabase.from('financial_goals').update(payload).eq('id', goal.id)
      if (error) { toast.error('Erro ao registrar valor.'); return }
      toast.success('Valor registrado.')
      onOpenChange(false)
      setAmount('')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Registrar valor em &quot;{goal.name}&quot;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Valor a somar</Label>
            <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value))} placeholder="0,00" autoFocus required />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
