'use client'

import { useState } from 'react'
import { Search, Loader2, Sparkles, TriangleAlert, BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { TransactionTable } from './transaction-table'
import { useTransactionSearch } from '@/hooks/use-transaction-search'
import { FinancialAccount, TransactionCategory, TransactionWithCategory, Partner } from '@/types/database'

interface Props {
  transactions: TransactionWithCategory[]
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
  partners: Partner[]
  highlights: { id: string; title: string; budgetCategories: { id: string; label: string }[] }[]
}

// Busca inteligente da tela de Lançamentos (a pedido do usuário — muitos
// lançamentos acumulados, difícil achar um específico só pelos filtros de
// conta/categoria já existentes). Filtro instantâneo por nome, categoria,
// data (aceita "setembro", "15/09", "2026", "hoje") e valor; quando nada
// bate, tenta de novo com sinônimos via IA (ver `useTransactionSearch`).
export function TransactionSearchPanel({ transactions, accounts, categories, partners, highlights }: Props) {
  const [search, setSearch] = useState('')
  const { filtered, expanding, aiAssisted, expansionFailed, localAssisted, expansionEmpty, expansionTerms } = useTransactionSearch(transactions, search)
  const trimmed = search.trim()

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder="Buscar por nome, categoria, data (ex: setembro) ou valor..."
          className="h-9 pl-9 pr-9"
        />
        {expanding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {aiAssisted && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 shrink-0" /> Ampliamos a busca com termos relacionados a &quot;{trimmed}&quot;.
        </p>
      )}
      {localAssisted && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3 w-3 shrink-0" /> Ampliamos a busca usando um dicionário local — a IA não está disponível agora.
        </p>
      )}
      {expansionFailed && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <TriangleAlert className="h-3 w-3 shrink-0" /> Não conseguimos ampliar essa busca agora — mostrando só o resultado direto.
        </p>
      )}
      {expansionEmpty && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Tentamos ampliar com termos relacionados a &quot;{trimmed}&quot;, mas não achamos nada — pode não haver nenhum lançamento sobre isso ainda.
          {expansionTerms.length > 0 && <span className="italic"> (termos tentados: {expansionTerms.join(', ')})</span>}
        </p>
      )}

      <TransactionTable
        transactions={filtered}
        accounts={accounts}
        categories={categories}
        partners={partners}
        highlights={highlights}
        emptyTitle={trimmed ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento ainda.'}
        emptyHint={trimmed ? `Não encontramos nada pra "${trimmed}".` : undefined}
      />
    </div>
  )
}
