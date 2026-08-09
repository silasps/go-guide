'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CURRENCIES, toMasked } from '@/lib/currency-mask'
import { SupportTypesPicker } from '@/components/highlights/support-types-picker'
import { BudgetCategoriesEditor } from '@/components/highlights/budget-categories-editor'
import { PROJECT_CATEGORIES } from '@/lib/highlights/project-categories'
import { cn } from '@/lib/utils'
import type { useProjectComposer } from './use-project-composer'

interface Props {
  composer: ReturnType<typeof useProjectComposer>
}

export function StepGoalSupport({ composer }: Props) {
  const t = useTranslations('ProjectComposer')
  const {
    goalTypes, setGoalTypes, categories, setCategories,
    currency, handleCurrencyChange, goalAmount, setGoalAmount,
    budgetMode, setBudgetMode, budgetCategories, setBudgetCategories,
  } = composer

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="space-y-2">
        <Label>{t('supportLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('supportHint')}</p>
        <SupportTypesPicker selected={goalTypes} onChange={setGoalTypes} />
      </div>

      <div className="space-y-2">
        <Label>{t('categoryLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('categoryHint')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {PROJECT_CATEGORIES.map(({ value, emoji, label }) => {
            const selected = categories.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategories((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]))}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors',
                  selected
                    ? 'border-primary bg-primary/8 text-foreground font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                )}
              >
                <span>{emoji}</span>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {goalTypes.includes('financial') && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="currency">{t('currencyLabel')}</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {budgetMode === 'single' && (
              <div className="space-y-2">
                <Label htmlFor="goal">{t('goalLabel')}</Label>
                <Input
                  id="goal"
                  inputMode="numeric"
                  value={goalAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoalAmount(toMasked(e.target.value, currency))}
                  placeholder="0,00"
                />
              </div>
            )}
          </div>

          <BudgetCategoriesEditor
            currency={currency}
            mode={budgetMode}
            onModeChange={setBudgetMode}
            categories={budgetCategories}
            onChange={setBudgetCategories}
          />
        </div>
      )}
    </div>
  )
}
