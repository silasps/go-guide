import type { Locale } from '@/i18n/config'

export interface HistoryBlock {
  id: string
  profile_id: string
  type: 'who_we_are' | 'our_calling' | 'timeline' | 'cta' | 'text'
  content: Record<string, unknown>
  original_locale: Locale
  order_index: number
  created_at: string
  updated_at: string
}
