'use client'

import { useTranslations } from 'next-intl'

const PRESETS = [1, 3, 6, 12]

interface Props {
  value: number | null
  onSelect: (months: number | null) => void
}

// Mesmo visual do AmountChips (chips + chip largo tracejado) — prazo do
// compromisso recorrente, vale tanto pro caminho Stripe quanto manual.
// `null` = sem prazo definido, preserva o comportamento indefinido de
// sempre (nunca encerra sozinho).
export function DurationChips({ value, onSelect }: Props) {
  const t = useTranslations('RecurringPledge')

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map(months => {
          const active = value === months
          return (
            <button
              key={months}
              type="button"
              onClick={() => onSelect(months)}
              className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-transparent text-foreground hover:border-primary/50'
              }`}
            >
              {t('durationMonths', { count: months })}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`h-10 w-full rounded-lg border border-dashed text-sm font-medium transition-colors ${
          value === null
            ? 'border-support bg-support text-support-foreground'
            : 'border-support/50 bg-support/5 text-support hover:bg-support/10'
        }`}
      >
        {t('durationIndefinite')}
      </button>
    </div>
  )
}
