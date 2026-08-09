import type { BudgetCategoryType } from '@/types/database'

// Fonte única do rótulo de cada tipo de categoria de orçamento — antes
// duplicado em budget-categories-editor.tsx e budget-breakdown.tsx.
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

export function resolveBudgetCategoryLabel(category: { category_type: BudgetCategoryType; custom_label: string | null }): string {
  return category.category_type === 'other' ? (category.custom_label || 'Outros') : BUDGET_CATEGORY_LABELS[category.category_type]
}
