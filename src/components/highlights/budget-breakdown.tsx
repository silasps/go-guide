import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { buttonVariants } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { ProjectBudgetProgress } from '@/types/database'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'

interface Props {
  categories: ProjectBudgetProgress[]
  currency: string
  /** Presente só quando dá pra contribuir direto daqui (perfil público) —
   *  ausente no contexto de edição/gestão, onde a lista é só leitura. */
  contributeBaseHref?: string
  contributeLabel?: string
  heading?: string
  missingLabel?: (amount: string) => string
}

export function BudgetBreakdown({ categories, currency, contributeBaseHref, contributeLabel, heading, missingLabel }: Props) {
  if (categories.length === 0) return null

  // No modo "contribuir" (perfil público, contributeBaseHref presente), o
  // valor que falta some da lista — pedido do usuário: a linha "Faltam
  // R$X" ficava visualmente colada no item de baixo, dando a impressão de
  // pertencer a ele. O valor volta a aparecer só depois de clicar em
  // "Contribuir" (chip "Cobrir o que falta" no formulário de oferta, ver
  // pledge-form.tsx). No modo admin (sem contributeBaseHref, só leitura),
  // continua mostrando aqui — é a única forma de ver esse número lá.
  const showMissingInline = !contributeBaseHref

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{heading ?? 'Orçamento detalhado'}</h3>
      <div className="space-y-2.5">
        {categories.map(c => {
          const label = resolveBudgetCategoryLabel(c)
          const missing = Math.max(0, c.target_amount - c.raised_amount)
          const isFunded = missing <= 0
          const pct = c.target_amount > 0 ? Math.min(100, (c.raised_amount / c.target_amount) * 100) : 0
          return (
            <div key={c.id} className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground shrink-0">{formatCurrency(c.raised_amount, currency)} / {formatCurrency(c.target_amount, currency)}</span>
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground">{c.description}</p>
              )}
              <Progress value={pct} className="h-1.5" />
              <div className="flex items-center justify-between gap-2">
                {(showMissingInline || isFunded) ? (
                  <p className="text-xs font-medium text-support">
                    {isFunded ? '🎉' : (missingLabel ? missingLabel(formatCurrency(missing, currency)) : `Faltam ${formatCurrency(missing, currency)}`)}
                  </p>
                ) : <span />}
                {contributeBaseHref && (
                  <Link
                    href={`${contributeBaseHref}&category=${c.id}`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs px-2.5 shrink-0 border-support text-support hover:bg-support/10 hover:text-support')}
                  >
                    {contributeLabel ?? 'Contribuir'}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
