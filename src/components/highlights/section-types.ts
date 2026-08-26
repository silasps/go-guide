import type { Locale } from '@/i18n/config'
import type { ContentTranslation } from '@/types/database'

export interface HighlightSnapshot {
  originalLocale: Locale
  title: string
  titleTranslations: Partial<Record<Locale, ContentTranslation>>
  description: string
  descriptionTranslations: Partial<Record<Locale, ContentTranslation>>
  goalTypes: string[]
  category: string[]
  goalAmount: number | null
  currentAmount: number
  currency: string
  coverUrl: string | null
  coverPosition: string
  coverMediaType: 'image' | 'video'
  coverStatus: 'ready' | 'processing' | 'failed'
  coverBunnyVideoId: string | null
  tripStartDate: string | null
  fundingDeadline: string | null
  scripture: string
  scriptureTranslations: Partial<Record<Locale, ContentTranslation>>
  letter: string
  letterTranslations: Partial<Record<Locale, ContentTranslation>>
  status: string
  milestones: { id?: string; title: string; titleTranslations: Partial<Record<Locale, ContentTranslation>>; is_completed: boolean }[]
  budgetCategories: { category_type: string; custom_label: string | null; description: string | null; target_amount: number }[]
  galleryImages: string[]
}

export interface SectionProps {
  canEdit: boolean
  snapshot: HighlightSnapshot
  highlightId: string
  profileId: string
  children: React.ReactNode
}
