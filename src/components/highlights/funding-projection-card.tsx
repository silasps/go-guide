import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { computeFundingProjection, daysUntil } from '@/lib/financial/projection'
import { Rocket, Handshake } from 'lucide-react'

interface Props {
  raisedAmount: number
  goalAmount: number | null
  currency: string
  createdAt: string
  fundingDeadline: string | null
  tripStartDate: string | null
  /** Link "Contribuir" — presente só na tela pública (o dono não contribui
   *  com o próprio projeto). */
  contributeHref?: string
}

// Tom sempre convidativo, nunca de alarme/cobrança — não é um aviso de
// "vocês não vão bater a meta", é um convite pra virar esse jogo. Motivado
// por feedback direto do usuário: o card antes mostrava um aviso vermelho
// ("ritmo atual não deve alcançar a meta") pra qualquer visitante, o que
// soa como culpa/pressão em vez de engajar.
const STATUS_STYLE = {
  green: { icon: Rocket, color: 'text-green-600', label: 'Esse projeto está avançando bem 🚀' },
  yellow: { icon: Handshake, color: 'text-amber-600', label: 'Quase lá — um empurrãozinho faz a diferença' },
  red: { icon: Handshake, color: 'text-support', label: 'Esse projeto ainda precisa de apoio pra decolar' },
  neutral: { icon: Handshake, color: 'text-muted-foreground', label: 'Acompanhe o avanço deste projeto' },
}

export function FundingProjectionCard({ raisedAmount, goalAmount, currency, createdAt, fundingDeadline, tripStartDate, contributeHref }: Props) {
  const projection = computeFundingProjection({ raisedAmount, goalAmount, createdAt, fundingDeadline })
  const { icon: Icon, color, label } = STATUS_STYLE[projection.status]

  const daysToStart = daysUntil(tripStartDate)

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className={`flex items-center gap-2 text-sm font-medium ${color}`}>
            <Icon className="h-4 w-4" />
            {label}
          </div>
          {contributeHref && (projection.status === 'red' || projection.status === 'yellow') && (
            <Link href={contributeHref} className={cn(buttonVariants({ variant: 'support', size: 'sm' }), 'text-xs')}>
              Contribuir agora
            </Link>
          )}
        </div>
        {projection.daysRemaining !== null && (
          <p className="text-xs text-muted-foreground">
            No ritmo atual ({formatCurrency(projection.dailyPace, currency)}/dia), a projeção é fechar com{' '}
            <span className="font-medium text-foreground">{formatCurrency(projection.projectedFinal, currency)}</span>
            {goalAmount ? ` (meta: ${formatCurrency(goalAmount, currency)})` : ''} — sua contribuição muda essa conta.
          </p>
        )}
        {daysToStart !== null && daysToStart >= 0 && (
          <p className="text-xs text-muted-foreground">Faltam {daysToStart} dia(s).</p>
        )}
      </CardContent>
    </Card>
  )
}
