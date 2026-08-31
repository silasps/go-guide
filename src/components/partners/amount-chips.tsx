'use client'

import { formatCurrency } from '@/lib/utils'
import { toMasked } from '@/lib/currency-mask'

// Valores sugeridos por moeda — não é conversão real, só uma faixa razoável
// de "clique rápido" por região, igual ao chip de valor do mockup do Stitch.
const PRESETS: Record<string, number[]> = {
  BRL: [50, 100, 200, 500],
  USD: [10, 25, 50, 100],
  EUR: [10, 25, 50, 100],
  GBP: [10, 25, 50, 100],
  CHF: [10, 25, 50, 100],
  CAD: [15, 30, 60, 120],
  AUD: [15, 30, 60, 120],
}

export interface RemainingOption {
  /** Valor total (se nada foi levantado ainda) ou valor que falta pra bater a meta. */
  amount: number
  label: string
}

interface Props {
  currency: string
  selectedMasked: string
  onSelect: (masked: string) => void
  /** Chip extra pra cobrir o valor total do projeto/etapa ou o que falta pra bater a meta. */
  remaining?: RemainingOption | null
}

export function AmountChips({ currency, selectedMasked, onSelect, remaining }: Props) {
  const presets = PRESETS[currency] ?? PRESETS.BRL
  const remainingMasked = remaining ? toMasked(String(Math.round(remaining.amount * 100)), currency) : null

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {presets.map(v => {
          const masked = toMasked(String(v * 100), currency)
          const active = selectedMasked === masked
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(masked)}
              className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-transparent text-foreground hover:border-primary/50'
              }`}
            >
              {formatCurrency(v, currency)}
            </button>
          )
        })}
      </div>
      {remaining && remaining.amount > 0 && remainingMasked && (
        <button
          type="button"
          onClick={() => onSelect(remainingMasked)}
          className={`h-10 w-full rounded-lg border border-dashed text-sm font-medium transition-colors ${
            selectedMasked === remainingMasked
              ? 'border-support bg-support text-support-foreground'
              : 'border-support/50 bg-support/5 text-support hover:bg-support/10'
          }`}
        >
          {remaining.label}
        </button>
      )}
    </div>
  )
}
