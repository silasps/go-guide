import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
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
const STATUS_ICON = {
  green: { icon: Rocket, color: 'text-green-600' },
  yellow: { icon: Handshake, color: 'text-amber-600' },
  red: { icon: Handshake, color: 'text-support' },
  neutral: { icon: Handshake, color: 'text-muted-foreground' },
}

export async function FundingProjectionCard({ raisedAmount, goalAmount, currency, createdAt, fundingDeadline, tripStartDate, contributeHref }: Props) {
  const t = await getTranslations('FundingProjectionCard')
  const projection = computeFundingProjection({ raisedAmount, goalAmount, createdAt, fundingDeadline })
  const { icon: Icon, color } = STATUS_ICON[projection.status]
  const label = {
    green: t('statusGreen'),
    yellow: t('statusYellow'),
    red: t('statusRed'),
    neutral: t('statusNeutral'),
  }[projection.status]

  const daysToStart = daysUntil(tripStartDate)

  // Em vez do total projetado (que extrapola o ritmo dos primeiros dias e
  // pode disparar bem acima da meta — ex.: R$2.500/dia dá R$25.000 numa
  // meta de R$9.000), mostra quanto ainda falta pra bater a meta. O total
  // projetado gigante fazia o texto soar incoerente: "já vai passar da
  // meta" seguido de "faltam N dias" e "sua contribuição muda essa conta"
  // — como se ajudar servisse só pra inflar um número que já estourou,
  // desmotivando quem via o card (feedback direto do usuário).
  const remaining = goalAmount ? Math.max(0, goalAmount - raisedAmount) : null

  let remainingMessage: string | null = null
  if (remaining !== null && remaining > 0) {
    const formattedRemaining = formatCurrency(remaining, currency)
    if (projection.daysRemaining === null) {
      remainingMessage = t('remainingNoDeadline', { remaining: formattedRemaining })
    } else {
      const key = projection.status === 'green' ? 'remainingGreen' : projection.status === 'yellow' ? 'remainingYellow' : 'remainingRed'
      remainingMessage = t(key, { remaining: formattedRemaining, days: projection.daysRemaining })
    }
  }

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
              {t('contributeNow')}
            </Link>
          )}
        </div>
        {remainingMessage && <p className="text-xs text-muted-foreground">{remainingMessage}</p>}
        {daysToStart !== null && daysToStart >= 0 && (
          <p className="text-xs text-muted-foreground">{t('daysUntilTrip', { days: daysToStart })}</p>
        )}
      </CardContent>
    </Card>
  )
}
