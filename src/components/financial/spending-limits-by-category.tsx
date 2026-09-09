'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency, cn } from '@/lib/utils'
import { SpendingLimit, TransactionCategory } from '@/types/database'
import { SpendingLimitForm } from './spending-limit-form'
import { Progress } from '@/components/ui/progress'
import { Button, buttonVariants } from '@/components/ui/button'
import { Pencil, Plus, ArrowRight } from 'lucide-react'

interface Props {
  categories: TransactionCategory[] // só categorias de topo (spending_limits não vale pra subcategoria, ver 7.20)
  limits: SpendingLimit[]
  spentByCategory: Record<string, number>
  profileId: string
  currencies: string[]
  enforceZeroLimit: boolean
}

const DEFAULT_COLOR = 'var(--muted-foreground)'

type FormTarget = { mode: 'edit'; limit: SpendingLimit } | { mode: 'create'; categoryId: string }

interface RowProps {
  category: TransactionCategory
  limit: SpendingLimit | undefined
  spent: number
  currencies: string[]
  onEdit: () => void
  enforceZeroLimit: boolean
}

function CategoryRow({ category, limit, spent, currencies, onEdit, enforceZeroLimit }: RowProps) {
  const color = category.color ?? DEFAULT_COLOR
  const rowCurrency = limit?.currency ?? currencies[0] ?? 'BRL'

  // Limite geral em modo "soma por categoria" (ver `GeneralLimitSettings`):
  // categoria sem limite próprio passa a valer como limite R$0 — qualquer
  // gasto nela já é "estourado", forçando a pessoa a definir um limite de
  // verdade em vez de deixar esse gasto invisível pra lógica de soma.
  const impliedOverLimit = !limit && enforceZeroLimit && spent > 0

  // `rawPct` sem cap alimenta o texto (200% de verdade quando estourou o
  // dobro, não trava em 100% — pedido do usuário); `pct` com cap alimenta só
  // a largura da barra, que não tem como desenhar além do próprio contêiner.
  const rawPct = limit && limit.limit_amount > 0 ? (spent / limit.limit_amount) * 100 : 0
  const pct = impliedOverLimit ? 100 : Math.min(100, rawPct)
  const overLimit = (!!limit && spent > limit.limit_amount) || impliedOverLimit
  const nearLimit = !!limit && !overLimit && rawPct >= 80
  const pctColor = overLimit ? 'text-destructive' : nearLimit ? 'text-warning' : 'text-success'
  const hasSignal = !!limit || impliedOverLimit // linha "vazia" (sem limite, sem gasto) continua sem sinal nenhum

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className={cn('text-sm font-semibold truncate', !hasSignal && 'text-muted-foreground')}>{category.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className="text-sm whitespace-nowrap">
            <span className={cn('font-semibold', hasSignal && (overLimit ? 'text-destructive' : 'text-success'))}>{formatCurrency(spent, rowCurrency)}</span>
            <span className="text-muted-foreground"> de {formatCurrency(limit?.limit_amount ?? 0, rowCurrency)}</span>
          </span>
          <Link href={`/dashboard/financeiro/lancamentos?category=${category.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
            Ver transações <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Button variant="outline" size="icon-sm" title={limit ? 'Editar limite' : 'Definir limite'} onClick={onEdit}>
            {limit ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <Progress
        value={pct}
        className={cn(overLimit && '[&_[data-slot=progress-indicator]]:bg-destructive', nearLimit && '[&_[data-slot=progress-indicator]]:bg-warning')}
      />

      {/* `invisible` (não `hidden`) quando não há sinal: mantém a altura da
          linha reservada, senão as linhas sem limite ficam mais baixas que
          as com limite e a lista desalinha. */}
      <div className={cn('flex justify-end', !hasSignal && 'invisible')}>
        {impliedOverLimit ? (
          <span className="text-xs font-semibold text-destructive">Estourado — defina um limite</span>
        ) : (
          <span className={cn('text-xs font-semibold', pctColor)}>{Math.round(rawPct)}%</span>
        )}
      </div>
    </div>
  )
}

// Lista "Por categoria" estilo GranaZen: uma linha por categoria de topo,
// separadas em dois grupos — com limite primeiro (o que a pessoa veio
// acompanhar), sem limite depois (pedido do usuário: "deve ser mais
// organizado... os que tem limite cadastrado e os que não tem" — antes
// vinha tudo junto em ordem alfabética, misturando as duas coisas).
// `enforceZeroLimit` (ligado quando o limite geral está em modo "soma por
// categoria", ver `CategoryRow`) trata categoria sem limite como se tivesse
// limite R$0 quando há gasto nela — ideia do próprio usuário, pra forçar
// definir um limite de verdade em vez do gasto ficar invisível pra soma.
// Cada linha tem sua própria barra de progresso — o mesmo formato de linhas
// empilhadas do card "Progresso do limite total" acima dela, pra permitir
// uma única linha vertical "Hoje" atravessando tudo (ver `SpendingLimitsTabs`).
export function SpendingLimitsByCategory({ categories, limits, spentByCategory, profileId, currencies, enforceZeroLimit }: Props) {
  const [target, setTarget] = useState<FormTarget | null>(null)
  const limitByCategory = new Map(limits.map((l) => [l.category_id, l]))
  const usedCategoryIds = limits.map((l) => l.category_id)

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma categoria cadastrada ainda.</p>
  }

  const withLimit = categories.filter((c) => limitByCategory.has(c.id))
  const withoutLimit = categories.filter((c) => !limitByCategory.has(c.id))

  function edit(cat: TransactionCategory, limit: SpendingLimit | undefined) {
    setTarget(limit ? { mode: 'edit', limit } : { mode: 'create', categoryId: cat.id })
  }

  return (
    <div className="space-y-3">
      {withLimit.map((cat) => (
        <CategoryRow key={cat.id} category={cat} limit={limitByCategory.get(cat.id)} spent={spentByCategory[cat.id] ?? 0} currencies={currencies} onEdit={() => edit(cat, limitByCategory.get(cat.id))} enforceZeroLimit={enforceZeroLimit} />
      ))}

      {withLimit.length > 0 && withoutLimit.length > 0 && (
        <p className="text-xs font-medium text-muted-foreground pt-1">Sem limite cadastrado</p>
      )}

      {withoutLimit.map((cat) => (
        <CategoryRow key={cat.id} category={cat} limit={undefined} spent={spentByCategory[cat.id] ?? 0} currencies={currencies} onEdit={() => edit(cat, undefined)} enforceZeroLimit={enforceZeroLimit} />
      ))}

      {target && (
        <SpendingLimitForm
          open
          onOpenChange={(v) => !v && setTarget(null)}
          limit={target.mode === 'edit' ? target.limit : undefined}
          initialCategoryId={target.mode === 'create' ? target.categoryId : undefined}
          profileId={profileId}
          categories={categories}
          currencies={currencies}
          usedCategoryIds={usedCategoryIds}
        />
      )}
    </div>
  )
}
