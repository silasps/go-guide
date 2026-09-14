'use client'

import { useState } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { FinancialAccount } from '@/types/database'
import { AccountCard } from './account-card'
import { AccountWizard } from './account-wizard'
import { Button } from '@/components/ui/button'
import { Landmark, Archive, Wallet, Plus } from 'lucide-react'

interface Member { id: string; user_id: string; account_id: string; role: string }

interface Props {
  profileId: string
  accounts: FinancialAccount[]
  members: Member[]
  currentBills: Record<string, number>
}

type Tab = 'active' | 'archived'

const TABS: { value: Tab; label: string; icon: typeof Landmark }[] = [
  { value: 'active', label: 'Ativas', icon: Landmark },
  { value: 'archived', label: 'Arquivadas', icon: Archive },
]

// Abas Ativas/Arquivadas (estilo GranaZen, ver 7.29) — `financial_accounts.archived`
// já existia no schema desde sempre, sem nenhuma UI até aqui.
export function AccountsList({ profileId, accounts, members, currentBills }: Props) {
  const [tab, setTab] = useState<Tab>('active')
  const [creating, setCreating] = useState(false)
  const filtered = accounts.filter((a) => (tab === 'active' ? !a.archived : a.archived))
  // Só soma contas não-crédito — saldo de cartão é a fatura (calculada por
  // transações não pagas), não a coluna `balance`, misturar os dois daria
  // um "saldo total" sem sentido. Agrupado por moeda: somar BRL com USD
  // direto no número daria um total sem sentido também, então cada moeda
  // que aparecer ganha sua própria linha.
  const nonCredit = filtered.filter((a) => a.account_type !== 'credit')
  const totalsByCurrency = nonCredit.reduce<Record<string, number>>((totals, a) => {
    totals[a.currency_code] = (totals[a.currency_code] ?? 0) + a.balance
    return totals
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreating(true)} className="w-fit gap-2">
          <Plus className="h-4 w-4" /> Adicionar conta
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex h-9 items-center rounded-lg bg-muted/60 p-1 text-muted-foreground">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all',
                tab === t.value ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {nonCredit.length > 0 && (
          <div className="hidden min-w-56 items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm md:flex">
            <div className="min-w-0 flex-1 space-y-0.5">
              <h3 className="text-xs font-medium leading-none text-muted-foreground">Saldo total</h3>
              <p className="truncate text-xs leading-none text-muted-foreground">{nonCredit.length} conta{nonCredit.length === 1 ? '' : 's'}</p>
            </div>
            <div className="shrink-0 space-y-0.5 text-right">
              {Object.entries(totalsByCurrency).map(([currency, total]) => (
                <p key={currency} className="truncate text-sm font-semibold text-foreground">{formatCurrency(total, currency)}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border bg-card px-4 py-12 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1.5 text-base font-semibold">{tab === 'active' ? 'Nenhuma conta bancária' : 'Nenhuma conta arquivada'}</h3>
          <p className="mb-5 max-w-xs text-sm text-muted-foreground">
            {tab === 'active'
              ? 'Adicione sua primeira conta bancária para começar a organizar suas finanças.'
              : 'Contas arquivadas aparecem aqui.'}
          </p>
          {tab === 'active' && (
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar conta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AccountCard key={a.id} account={a} profileId={profileId} accounts={accounts} members={members.filter((m) => m.account_id === a.id)} currentBill={currentBills[a.id] ?? 0} />
          ))}
        </div>
      )}

      {creating && <AccountWizard open onOpenChange={setCreating} profileId={profileId} />}
    </div>
  )
}
