'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { BudgetCategoriesEditor, type BudgetCategoryDraft } from './budget-categories-editor'
import { toMasked, fromMasked, reformatMasked, CURRENCIES } from '@/lib/currency-mask'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

function toDrafts(categories: SectionProps['snapshot']['budgetCategories'], currency: string): BudgetCategoryDraft[] {
  return categories.map(b => ({
    category_type: b.category_type as BudgetCategoryDraft['category_type'],
    custom_label: b.custom_label ?? '',
    target_amount: toMasked(String(Math.round(b.target_amount * 100)), currency),
  }))
}

export function FinancialEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [currency, setCurrency] = useState(snapshot.currency)
  const [goalAmount, setGoalAmount] = useState(
    snapshot.goalAmount ? toMasked(String(Math.round(snapshot.goalAmount * 100)), snapshot.currency) : ''
  )
  const [currentAmount, setCurrentAmount] = useState(
    toMasked(String(Math.round(snapshot.currentAmount * 100)), snapshot.currency)
  )
  const [budgetMode, setBudgetMode] = useState<'single' | 'detailed'>(
    snapshot.budgetCategories.length > 0 ? 'detailed' : 'single'
  )
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryDraft[]>(
    toDrafts(snapshot.budgetCategories, snapshot.currency)
  )

  if (!canEdit) return <>{children}</>

  function resetDraft() {
    setCurrency(snapshot.currency)
    setGoalAmount(snapshot.goalAmount ? toMasked(String(Math.round(snapshot.goalAmount * 100)), snapshot.currency) : '')
    setCurrentAmount(toMasked(String(Math.round(snapshot.currentAmount * 100)), snapshot.currency))
    setBudgetMode(snapshot.budgetCategories.length > 0 ? 'detailed' : 'single')
    setBudgetCategories(toDrafts(snapshot.budgetCategories, snapshot.currency))
  }

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionFinancial') })}
          onClick={() => { resetDraft(); setEditing(true) }}
        />
      </div>
    )
  }

  function handleCurrencyChange(newCurrency: string) {
    setGoalAmount(prev => reformatMasked(prev, currency, newCurrency))
    setCurrentAmount(prev => reformatMasked(prev, currency, newCurrency))
    setBudgetCategories(prev => prev.map(b => ({ ...b, target_amount: reformatMasked(b.target_amount, currency, newCurrency) })))
    setCurrency(newCurrency)
  }

  const budgetTotal = budgetCategories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  async function handleSave() {
    const isDetailedBudget = budgetMode === 'detailed'
    const ok = await save({
      ...snapshot,
      highlightId,
      profileId,
      currency,
      goalAmount: isDetailedBudget ? budgetTotal : (goalAmount ? parseFloat(fromMasked(goalAmount, currency)) : null),
      currentAmount: parseFloat(fromMasked(currentAmount, currency)) || 0,
      budgetCategories: isDetailedBudget
        ? budgetCategories
            .filter(b => parseFloat(fromMasked(b.target_amount, currency)) > 0)
            .map(b => ({
              category_type: b.category_type,
              custom_label: b.category_type === 'other' ? (b.custom_label.trim() || 'Outros') : null,
              target_amount: parseFloat(fromMasked(b.target_amount, currency)),
            }))
        : [],
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed p-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5 col-span-1">
          <Label htmlFor="currency">Moeda</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {budgetMode === 'single' && (
          <div className="space-y-1.5">
            <Label htmlFor="goal">Meta</Label>
            <Input id="goal" inputMode="numeric" value={goalAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoalAmount(toMasked(e.target.value, currency))} placeholder="0,00" />
          </div>
        )}
        {budgetMode === 'single' && (
          <div className="space-y-1.5">
            <Label htmlFor="current">Arrecadado</Label>
            <Input id="current" inputMode="numeric" value={currentAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentAmount(toMasked(e.target.value, currency))} placeholder="0,00" />
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

      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
