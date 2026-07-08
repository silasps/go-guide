'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { FinancialAccount, AccountType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']
const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra']

interface Props {
  profileId: string
  account?: FinancialAccount
}

export function AccountForm({ profileId, account }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { isPending: saving, run } = usePendingAction()
  const [name, setName] = useState(account?.name ?? '')
  const [currencyCode, setCurrencyCode] = useState(account?.currency_code ?? 'BRL')
  const [accountType, setAccountType] = useState<AccountType>(account?.account_type ?? 'checking')
  const [isShared, setIsShared] = useState(account?.is_shared ?? false)
  const [openingBalance, setOpeningBalance] = useState(account ? '' : '0')
  const [creditLimit, setCreditLimit] = useState(account?.credit_limit != null ? String(account.credit_limit) : '')
  const [closingDay, setClosingDay] = useState(account?.closing_day != null ? String(account.closing_day) : '')
  const [dueDay, setDueDay] = useState(account?.due_day != null ? String(account.due_day) : '')
  const [cardBrand, setCardBrand] = useState(account?.card_brand ?? '')
  const isCredit = accountType === 'credit'

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nome obrigatório.'); return }

    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const creditFields = isCredit ? {
        credit_limit: creditLimit ? parseFloat(creditLimit) : null,
        closing_day: closingDay ? parseInt(closingDay, 10) : null,
        due_day: dueDay ? parseInt(dueDay, 10) : null,
        card_brand: cardBrand || null,
      } : { credit_limit: null, closing_day: null, due_day: null, card_brand: null }

      if (account) {
        const { error } = await supabase.from('financial_accounts').update({
          name: name.trim(),
          account_type: accountType,
          is_shared: isShared,
          ...creditFields,
        }).eq('id', account.id)
        if (error) { toast.error('Erro ao salvar conta.'); return }
        toast.success('Conta atualizada.')
      } else {
        const { error } = await supabase.from('financial_accounts').insert({
          profile_id: profileId,
          name: name.trim(),
          currency_code: currencyCode,
          account_type: accountType,
          is_shared: isShared,
          balance: parseFloat(openingBalance) || 0,
          created_by_user_id: user!.id,
          ...creditFields,
        })
        if (error) { toast.error('Erro ao criar conta.'); return }
        toast.success('Conta criada.')
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant={account ? 'outline' : 'default'} size={account ? 'sm' : 'default'} className="gap-2">
          {!account && <Plus className="h-4 w-4" />}
          {account ? 'Editar' : 'Nova conta'}
        </Button>
      } />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar conta' : 'Nova conta financeira'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Ex: Conta pessoal, Conta do projeto..." required />
          </div>
          {!account && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Moeda</Label>
                <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Saldo inicial</Label>
                <Input inputMode="decimal" value={openingBalance} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpeningBalance(e.target.value)} placeholder="0" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
              <option value="checking">Conta corrente</option>
              <option value="savings">Poupança</option>
              <option value="credit">Cartão de crédito</option>
            </select>
          </div>
          {isCredit && (
            <div className="space-y-3 rounded-lg border border-input p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Limite total</Label>
                  <Input inputMode="decimal" value={creditLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreditLimit(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Bandeira</Label>
                  <select value={cardBrand} onChange={(e) => setCardBrand(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                    <option value="">Selecione</option>
                    {CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Dia de fechamento</Label>
                  <Input type="number" min={1} max={31} value={closingDay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosingDay(e.target.value)} placeholder="Ex: 15" />
                </div>
                <div className="space-y-2">
                  <Label>Dia de vencimento</Label>
                  <Input type="number" min={1} max={31} value={dueDay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDay(e.target.value)} placeholder="Ex: 22" />
                </div>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="rounded border-input" />
            Conta compartilhada (equipe/família)
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account ? 'Salvar' : 'Criar conta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
