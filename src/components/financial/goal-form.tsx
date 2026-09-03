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
  goal?: FinancialGoal
  profileId: string
  currencies: string[]
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

// Meta de economia manual (sem vínculo automático com conta/transação —
// decisão deliberada, ver migration 081): `current_amount` só muda aqui ou
// via "Registrar valor" no card (GoalContributionButton).
export function GoalForm({ open, onOpenChange, goal, profileId, currencies, trigger }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [name, setName] = useState(goal?.name ?? '')
  const [targetAmount, setTargetAmount] = useState(goal ? toMasked(String(Math.round(goal.target_amount * 100))) : '')
  const [currency, setCurrency] = useState(goal?.currency ?? currencies[0] ?? 'BRL')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Dê um nome pra meta.'); return }
    const parsedTarget = parseFloat(fromMasked(targetAmount))
    if (!parsedTarget || parsedTarget <= 0) { toast.error('Informe um valor alvo válido.'); return }

    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        profile_id: profileId,
        name: name.trim(),
        target_amount: parsedTarget,
        currency,
        target_date: targetDate || null,
      }

      const { error } = goal
        ? await supabase.from('financial_goals').update(payload).eq('id', goal.id)
        : await supabase.from('financial_goals').insert({ ...payload, created_by_user_id: user!.id })

      if (error) { toast.error('Erro ao salvar meta.'); return }
      toast.success(goal ? 'Meta atualizada.' : 'Meta criada.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal ? 'Editar meta' : 'Nova meta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Ex: Reserva de emergência" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor alvo</Label>
              <Input inputMode="numeric" value={targetAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetAmount(e.target.value === '' ? '' : toMasked(e.target.value))} placeholder="0,00" required />
            </div>
            {currencies.length > 1 && (
              <div className="space-y-2">
                <Label>Moeda</Label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Prazo (opcional)</Label>
            <Input type="date" value={targetDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetDate(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {goal ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
