import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'
import { ProjectBudgetProgress } from '@/types/database'

const BUDGET_CATEGORY_LABELS: Record<string, string> = {
  airfare: 'Passagem aérea',
  bus: 'Ônibus',
  boat: 'Barco',
  ferry: 'Balsa',
  rideshare: 'Uber/táxi',
  lodging: 'Estadia',
  food: 'Alimentação',
  equipment: 'Equipamento',
  visa_documentation: 'Visto/documentação',
  insurance: 'Seguro viagem',
  training: 'Treinamento',
  shipping: 'Envio de carga',
  other: 'Outros',
}

interface Props {
  categories: ProjectBudgetProgress[]
  currency: string
}

export function BudgetBreakdown({ categories, currency }: Props) {
  if (categories.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Orçamento detalhado</h3>
      <div className="space-y-3">
        {categories.map(c => {
          const label = c.category_type === 'other' ? (c.custom_label || 'Outros') : BUDGET_CATEGORY_LABELS[c.category_type]
          const pct = c.target_amount > 0 ? Math.min(100, (c.raised_amount / c.target_amount) * 100) : 0
          return (
            <div key={c.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{formatCurrency(c.raised_amount, currency)} / {formatCurrency(c.target_amount, currency)}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
