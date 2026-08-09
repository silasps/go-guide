'use client'

import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'

export interface BudgetCategoryOption {
  id: string
  label: string
  raised_amount: number
  target_amount: number
}

interface Props {
  categories: BudgetCategoryOption[]
  value: string | null
  onChange: (id: string | null) => void
  currency: string
  fieldLabel: string
  generalLabel: string
  missingLabel: (amount: string) => string
}

// Seletor "onde investir" — projeto geral (default) ou uma categoria
// específica do orçamento detalhado. Só aparece quando o projeto tem
// categorias cadastradas; usado tanto em PledgeForm quanto RecurringPledgeForm.
export function BudgetCategorySelect({ categories, value, onChange, currency, fieldLabel, generalLabel, missingLabel }: Props) {
  if (categories.length === 0) return null

  return (
    <div className="space-y-2">
      <Label>{fieldLabel}</Label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
      >
        <option value="">{generalLabel}</option>
        {categories.map((c) => {
          const missing = Math.max(0, c.target_amount - c.raised_amount)
          return (
            <option key={c.id} value={c.id}>
              {c.label} — {missing > 0 ? missingLabel(formatCurrency(missing, currency)) : '✓'}
            </option>
          )
        })}
      </select>
    </div>
  )
}
