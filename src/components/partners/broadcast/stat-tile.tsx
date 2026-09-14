'use client'

import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export type BroadcastTrend = 'up' | 'down' | 'similar'

// Mesma técnica de contagem de src/components/financial/balance-summary.tsx
// (useCountUp) — spring em vez de duração fixa, cresce rápido no começo e
// assenta suave no fim.
function useCountUp(target: number) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 })
  const [display, setDisplay] = useState(0)

  useEffect(() => { motionValue.set(target) }, [target, motionValue])
  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => setDisplay(v))
    return unsubscribe
  }, [spring])

  return display
}

interface Props {
  value: number
  currency: string
  /** Cor fixa da paleta de gráfico (11.1) — chart-1/chart-2 são sempre
   *  entrada/saída em qualquer lugar do app (dashboard, aqui). Antes esta
   *  peça usava `accent_color` do perfil (arbitrário, não validado pra
   *  contraste/CVD); trocado pra ficar consistente com o resto do
   *  financeiro e garantir que a cor sempre passe nos checks da paleta.
   *  O label ("Arrecadado"/"Investido na missão") vem do próprio variant,
   *  já traduzido — nunca prop de texto livre. */
  variant: 'income' | 'expense'
  /** `lg` é o "momento wrapped" da página — um número grande antes de
   *  qualquer texto corrido, em vez de todo stat ter o mesmo peso visual
   *  (crítica do usuário: "nada tem peso visual"). Só a moeda dominante de
   *  arrecadação usa `lg`; qualquer outra entrada (outras moedas, gasto)
   *  continua no tamanho normal, lado a lado. */
  size?: 'default' | 'lg'
  /** Direção frente ao período anterior do mesmo perfil (mesma
   *  periodLabel, nunca 30d vs 90d) — nunca um valor/percentual, só a seta
   *  (ver `get_broadcast_trend`, migration 103): um percentual já daria
   *  pra recalcular o valor exato do período anterior a partir do atual. */
  trend?: BroadcastTrend | null
}

export function BroadcastStatTile({ value, currency, variant, size = 'default', trend }: Props) {
  const t = useTranslations('PartnerUpdate')
  const display = useCountUp(value)
  const isLarge = size === 'lg'

  return (
    <div className={`bg-card border rounded-2xl ${isLarge ? 'p-5' : 'p-4'}`}>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs text-muted-foreground">{variant === 'income' ? t('statIncome') : t('statExpense')}</p>
        {trend && trend !== 'similar' && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${trend === 'up' ? 'text-chart-1' : 'text-muted-foreground'}`}>
            {trend === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {trend === 'up' ? t('trendUp') : t('trendDown')}
          </span>
        )}
      </div>
      <p className={`font-bold tabular-nums ${variant === 'income' ? 'text-chart-1' : 'text-chart-2'} ${isLarge ? 'text-4xl' : 'text-xl'}`}>
        {formatCurrency(display, currency)}
      </p>
    </div>
  )
}
