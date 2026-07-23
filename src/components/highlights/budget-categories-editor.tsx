'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import type { BudgetCategoryType } from '@/types/database'
import { toMasked, fromMasked } from '@/lib/currency-mask'
import { useState } from 'react'

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategoryType, string> = {
  airfare: 'Passagem aérea',
  bus: 'Ônibus',
  boat: 'Barco',
  ferry: 'Balsa',
  rideshare: 'Uber/táxi',
  lodging: 'Estadia',
  food: 'Alimentação',
  equipment: 'Equipamento',
  visa_documentation: 'Visto/documentação',
  insurance: 'Seguro viagem',
  training: 'Treinamento',
  shipping: 'Envio de carga',
  other: 'Outros',
}

export interface BudgetCategoryDraft { category_type: BudgetCategoryType; custom_label: string; target_amount: string }

interface Props {
  currency: string
  mode: 'single' | 'detailed'
  onModeChange: (mode: 'single' | 'detailed') => void
  categories: BudgetCategoryDraft[]
  onChange: (categories: BudgetCategoryDraft[]) => void
}

export function BudgetCategoriesEditor({ currency, mode, onModeChange, categories, onChange }: Props) {
  const [newType, setNewType] = useState<BudgetCategoryType>('airfare')

  function addCategory() {
    onChange([...categories, { category_type: newType, custom_label: '', target_amount: '' }])
  }
  function removeCategory(idx: number) {
    onChange(categories.filter((_, i) => i !== idx))
  }
  function updateCategory(idx: number, patch: Partial<BudgetCategoryDraft>) {
    onChange(categories.map((b, i) => i === idx ? { ...b, ...patch } : b))
  }

  const budgetTotal = categories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Orçamento detalhado por categoria</Label>
        <button
          type="button"
          onClick={() => onModeChange(mode === 'single' ? 'detailed' : 'single')}
          className="text-xs text-primary hover:underline"
        >
          {mode === 'single' ? 'Detalhar por categoria' : 'Usar meta única'}
        </button>
      </div>

      {mode === 'detailed' && (
        <div className="space-y-2 rounded-xl border p-3">
          {categories.map((b, i) => (
            <div key={i} className="flex gap-2 items-start">
              <select
                value={b.category_type}
                onChange={(e) => updateCategory(i, { category_type: e.target.value as BudgetCategoryType })}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring flex-1 min-w-0"
              >
                {Object.entries(BUDGET_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {b.category_type === 'other' && (
                <Input
                  value={b.custom_label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCategory(i, { custom_label: e.target.value })}
                  placeholder="Qual?"
                  className="h-8 text-xs flex-1"
                />
              )}
              <Input
                inputMode="numeric"
                value={b.target_amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCategory(i, { target_amount: toMasked(e.target.value, currency) })}
                placeholder="Valor"
                className="h-8 text-xs w-24 shrink-0"
              />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCategory(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as BudgetCategoryType)}
              className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
            >
              {Object.entries(BUDGET_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={addCategory} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Meta total (soma das categorias): <span className="font-medium text-foreground">{budgetTotal.toLocaleString('pt-BR', { style: 'currency', currency })}</span>
          </p>
        </div>
      )}
    </div>
  )
}
