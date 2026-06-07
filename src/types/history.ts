export interface HistoryBlock {
  id: string
  profile_id: string
  type: 'who_we_are' | 'our_calling' | 'timeline' | 'cta' | 'text'
  content: Record<string, unknown>
  order_index: number
  created_at: string
  updated_at: string
}
