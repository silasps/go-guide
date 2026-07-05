import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { computeFundingProjection, daysUntil } from '@/lib/financial/projection'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  raisedAmount: number
  goalAmount: number | null
  currency: string
  createdAt: string
  fundingDeadline: string | null
  tripStartDate: string | null
}

const STATUS_STYLE = {
  green: { icon: TrendingUp, color: 'text-green-600', label: 'No ritmo para bater a meta' },
  yellow: { icon: Minus, color: 'text-amber-600', label: 'Perto da meta, mas pode não chegar' },
  red: { icon: TrendingDown, color: 'text-red-600', label: 'Ritmo atual não deve alcançar a meta' },
  neutral: { icon: Minus, color: 'text-muted-foreground', label: 'Projeção de arrecadação' },
}

export function FundingProjectionCard({ raisedAmount, goalAmount, currency, createdAt, fundingDeadline, tripStartDate }: Props) {
  const projection = computeFundingProjection({ raisedAmount, goalAmount, createdAt, fundingDeadline })
  const { icon: Icon, color, label } = STATUS_STYLE[projection.status]

  const daysToTrip = daysUntil(tripStartDate)

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className={`flex items-center gap-2 text-sm font-medium ${color}`}>
          <Icon className="h-4 w-4" />
          {label}
        </div>
        {projection.daysRemaining !== null && (
          <p className="text-sm text-muted-foreground">
            No ritmo atual ({formatCurrency(projection.dailyPace, currency)}/dia), a projeção é fechar com{' '}
            <span className="font-medium text-foreground">{formatCurrency(projection.projectedFinal, currency)}</span>
            {goalAmount ? ` (meta: ${formatCurrency(goalAmount, currency)})` : ''}.
          </p>
        )}
        {daysToTrip !== null && daysToTrip >= 0 && (
          <p className="text-xs text-muted-foreground">Faltam {daysToTrip} dia(s) para a viagem.</p>
        )}
      </CardContent>
    </Card>
  )
}
