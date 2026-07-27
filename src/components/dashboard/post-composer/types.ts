export type ComposerStep = 'type' | 'media' | 'adjust' | 'details'

export interface TagDraft {
  id: string
  mediaIndex: number
  profileId: string
  displayName: string
  x: number
  y: number
}
