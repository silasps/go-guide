'use client'

import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

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
  label: string
  value: number
  currency: string
  /** Cor fixa da paleta de gráfico (11.1) — chart-1/chart-2 são sempre
   *  entrada/saída em qualquer lugar do app (dashboard, aqui). Antes esta
   *  peça usava `accent_color` do perfil (arbitrário, não validado pra
   *  contraste/CVD); trocado pra ficar consistente com o resto do
   *  financeiro e garantir que a cor sempre passe nos checks da paleta. */
  variant: 'income' | 'expense'
}

export function BroadcastStatTile({ label, value, currency, variant }: Props) {
  const display = useCountUp(value)
  return (
    <div className="bg-card border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${variant === 'income' ? 'text-chart-1' : 'text-chart-2'}`}>
        {formatCurrency(display, currency)}
      </p>
    </div>
  )
}
