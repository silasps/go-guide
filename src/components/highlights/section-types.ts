export interface HighlightSnapshot {
  title: string
  description: string
  goalTypes: string[]
  category: string[]
  goalAmount: number | null
  currentAmount: number
  currency: string
  coverUrl: string | null
  coverPosition: string
  tripStartDate: string | null
  fundingDeadline: string | null
  scripture: string
  letter: string
  status: string
  milestones: { id?: string; title: string; is_completed: boolean }[]
  budgetCategories: { category_type: string; custom_label: string | null; target_amount: number }[]
}

export interface SectionProps {
  canEdit: boolean
  snapshot: HighlightSnapshot
  highlightId: string
  profileId: string
  children: React.ReactNode
}
