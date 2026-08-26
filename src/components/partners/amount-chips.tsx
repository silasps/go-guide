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

interface Props {
  currency: string
  selectedMasked: string
  onSelect: (masked: string) => void
}

export function AmountChips({ currency, selectedMasked, onSelect }: Props) {
  const presets = PRESETS[currency] ?? PRESETS.BRL
  return (
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
  )
}
