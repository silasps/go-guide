'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { TransactionTable } from './transaction-table'
import { TransactionForm } from './transaction-form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTransactionSearch } from '@/hooks/use-transaction-search'
import { sortTransactionsByDate } from '@/lib/financial/sort-by-date'
import { FinancialAccount, TransactionCategory, TransactionWithCategory, Partner } from '@/types/database'
import { Search, Loader2, Sparkles, TriangleAlert, BookOpen, TrendingUp, TrendingDown, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'

interface Props {
  transactions: TransactionWithCategory[] // janela ampla, todos os meses/tipos
  month: string
  monthLabel: string
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
  partners: Partner[]
  highlights: { id: string; title: string; budgetCategories: { id: string; label: string }[] }[]
}

const TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
] as const

// Só uma amostra aqui — a lista inteira do mês inline na Visão Geral ocupa
// espaço demais na tela (pedido do usuário: "acho desnecessário, ocupa
// muito espaço"). Quem quiser ver tudo clica em "Ver todos" e vai pra
// `/dashboard/financeiro/lancamentos`, que já pagina/filtra de verdade.
const PREVIEW_LIMIT = 10

// Lançamentos do mês selecionado direto na Visão Geral (ver 7.20/7.22) —
// mesma `TransactionTable` de `/dashboard/financeiro/lancamentos` (edita,
// exclui, marca como pago), só escopada ao mês do `MonthNavigator` em vez
// de paginada por conta/categoria via query string. Botões de atalho
// Receita/Despesa abrem o mesmo `TransactionForm` já com o tipo pré-selecionado.
export function MonthTransactionsPanel({ transactions, month, monthLabel, accounts, categories, partners, highlights }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all')
  const [search, setSearch] = useState('')
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense' | null>(null)
  // Mais recente primeiro por padrão — como qualquer extrato de banco
  // (pedido do usuário: a query de `transactions` que alimenta este painel
  // não tem `order()`, então vinha em ordem de inserção, parecendo
  // crescente). `sortAsc` deixa a pessoa inverter num clique.
  const [sortAsc, setSortAsc] = useState(false)
  // `accounts` (completo) segue pra `TransactionTable` — precisa achar a
  // conta de lançamentos antigos mesmo já arquivada (ver 7.29). O atalho de
  // novo lançamento abaixo só oferece conta ativa.
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts])

  const monthAndTabFiltered = useMemo(() => {
    const scoped = transactions.filter((t) => {
      if (t.date.slice(0, 7) !== month) return false
      if (tab !== 'all' && t.type !== tab) return false
      return true
    })
    return sortTransactionsByDate(scoped, sortAsc)
  }, [transactions, month, tab, sortAsc])

  const { filtered, expanding, aiAssisted, expansionFailed, localAssisted, expansionEmpty, expansionTerms } = useTransactionSearch(monthAndTabFiltered, search)
  const trimmedSearch = search.trim()
  const visible = filtered.slice(0, PREVIEW_LIMIT)
  const hasMore = filtered.length > PREVIEW_LIMIT

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border p-0.5 gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn('px-2.5 py-1 rounded-md text-xs transition-colors', tab === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSortAsc((v) => !v)}
          title={sortAsc ? 'Mais antigas primeiro — clique pra inverter' : 'Mais recentes primeiro — clique pra inverter'}
          className="flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {sortAsc ? <ArrowUpNarrowWide className="h-3.5 w-3.5" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5" />}
          Data
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button type="button" size="sm" className="h-7 gap-1.5 bg-success text-success-foreground hover:bg-success/90" disabled={activeAccounts.length === 0} onClick={() => setQuickAddType('income')}>
            <TrendingUp className="h-3.5 w-3.5" /> Receita
          </Button>
          <Button type="button" size="sm" className="h-7 gap-1.5 bg-destructive text-white hover:bg-destructive/90" disabled={activeAccounts.length === 0} onClick={() => setQuickAddType('expense')}>
            <TrendingDown className="h-3.5 w-3.5" /> Despesa
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar por nome, categoria, data ou valor..." className="h-8 pl-8 pr-8 text-xs" />
        {expanding && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {aiAssisted && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 shrink-0" /> Ampliamos a busca com termos relacionados a &quot;{trimmedSearch}&quot;.
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
          Tentamos ampliar com termos relacionados a &quot;{trimmedSearch}&quot;, mas não achamos nada — pode não haver nenhum lançamento sobre isso ainda.
          {expansionTerms.length > 0 && <span className="italic"> (termos tentados: {expansionTerms.join(', ')})</span>}
        </p>
      )}

      <TransactionTable
        transactions={visible}
        accounts={accounts}
        categories={categories}
        partners={partners}
        highlights={highlights}
        emptyTitle={trimmedSearch ? 'Nenhum lançamento encontrado' : 'Nenhuma transação encontrada'}
        emptyHint={trimmedSearch ? `Não encontramos nada pra "${trimmedSearch}".` : `Não há transações para exibir em ${monthLabel.toLowerCase()}.`}
      />

      {filtered.length > 0 && (
        <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
          <span>{hasMore ? `Mostrando ${visible.length} de ${filtered.length}` : `Total: ${filtered.length}`}</span>
          {hasMore && (
            <Link href="/dashboard/financeiro/lancamentos" className="font-medium text-primary hover:underline">
              Ver todos
            </Link>
          )}
        </div>
      )}

      {quickAddType && (
        <TransactionForm
          open
          onOpenChange={(v) => !v && setQuickAddType(null)}
          defaultType={quickAddType}
          accounts={activeAccounts}
          categories={categories}
          partners={partners}
          highlights={highlights}
          transactions={transactions}
        />
      )}
    </div>
  )
}
