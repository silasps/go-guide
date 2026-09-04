'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Pledge, FinancialAccount } from '@/types/database'
import { PledgeReviewCard } from './pledge-review-card'
import { Inbox, Archive } from 'lucide-react'

type PledgeWithHighlight = Pledge & { highlight?: { title: string } | null }
type Tab = 'queue' | 'archived'

interface Props {
  pendingPledges: PledgeWithHighlight[]
  recentRejectedPledges: PledgeWithHighlight[]
  archivedPledges: PledgeWithHighlight[]
  accounts: FinancialAccount[]
  profileId: string
  budgetCategoriesByHighlight: Record<string, { id: string; label: string }[]>
}

const TABS: { value: Tab; label: string; icon: typeof Inbox }[] = [
  { value: 'queue', label: 'Pendentes', icon: Inbox },
  { value: 'archived', label: 'Arquivadas', icon: Archive },
]

// Abas Pendentes/Arquivadas, mesmo padrão pill já usado em Contas
// (Ativas/Arquivadas, ver 7.29) — aqui pra dar lugar à janela de reanálise
// de oferta recusada (ver pledge-windows.ts e 7.32).
export function ReconciliationTabs({ pendingPledges, recentRejectedPledges, archivedPledges, accounts, profileId, budgetCategoriesByHighlight }: Props) {
  const [tab, setTab] = useState<Tab>('queue')

  function renderCard(p: PledgeWithHighlight) {
    return (
      <PledgeReviewCard
        key={p.id}
        pledge={p}
        accounts={accounts}
        profileId={profileId}
        budgetCategories={p.highlight_id ? (budgetCategoriesByHighlight[p.highlight_id] ?? []) : []}
      />
    )
  }

  return (
    <div className="space-y-4">
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
            {t.value === 'archived' && archivedPledges.length > 0 && <span className="ml-0.5 text-xs">({archivedPledges.length})</span>}
          </button>
        ))}
      </div>

      {tab === 'queue' ? (
        pendingPledges.length === 0 && recentRejectedPledges.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma oferta pendente de confirmação.</p>
        ) : (
          <div className="space-y-4">
            {pendingPledges.length > 0 && <div className="space-y-3">{pendingPledges.map(renderCard)}</div>}
            {recentRejectedPledges.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground pt-1">Recusadas recentemente — ainda dá pra reconsiderar</p>
                {recentRejectedPledges.map(renderCard)}
              </div>
            )}
          </div>
        )
      ) : archivedPledges.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma oferta arquivada.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Recusadas há mais de uma semana — ainda dá pra reconsiderar e confirmar até completar 2 meses da recusa.</p>
          {archivedPledges.map(renderCard)}
        </div>
      )}
    </div>
  )
}
