import type { MediaAspectRatio } from '@/types/database'

export type ComposerStep = 'type' | 'media' | 'adjust' | 'details'

export interface MediaAdjustments {
  brightness: number
  contrast: number
  saturate: number
  hueRotate: number
}

export const DEFAULT_ADJUSTMENTS: MediaAdjustments = { brightness: 100, contrast: 100, saturate: 100, hueRotate: 0 }

export type FilterPresetId = 'none' | 'vivid' | 'warm' | 'cool' | 'mono' | 'fade'

export const FILTER_PRESETS: { id: FilterPresetId; filter: string }[] = [
  { id: 'none', filter: '' },
  { id: 'vivid', filter: 'contrast(1.12) saturate(1.35)' },
  { id: 'warm', filter: 'sepia(0.25) saturate(1.2) contrast(1.05)' },
  { id: 'cool', filter: 'hue-rotate(-8deg) saturate(1.1) contrast(1.05)' },
  { id: 'mono', filter: 'grayscale(1) contrast(1.1)' },
  { id: 'fade', filter: 'contrast(0.9) saturate(0.85) brightness(1.05)' },
]

export interface MediaDraft {
  id: string
  file: File
  type: 'image' | 'video'
  previewUrl: string
  /** Ponto focal do pan, em % (0-100), mesma semântica de object-position. */
  position: { x: number; y: number }
  zoom: number
  filterPreset: FilterPresetId
  adjustments: MediaAdjustments
}

/** Combina preset + sliders numa única string de filter CSS, usada tanto na
 *  preview ao vivo quanto para "assar" o filtro no canvas ao salvar. */
export function resolveCssFilter(media: Pick<MediaDraft, 'filterPreset' | 'adjustments'>): string {
  const preset = FILTER_PRESETS.find((p) => p.id === media.filterPreset)?.filter ?? ''
  const { brightness, contrast, saturate, hueRotate } = media.adjustments
  const adjustPart = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`
  return [preset, adjustPart].filter(Boolean).join(' ')
}

export interface TagDraft {
  id: string
  mediaIndex: number
  profileId: string
  displayName: string
  x: number
  y: number
}

export const ASPECT_RATIO_CLASS: Record<MediaAspectRatio, string> = {
  original: '',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '16:9': 'aspect-video',
}

export function createMediaDraft(file: File, type: 'image' | 'video'): MediaDraft {
  return {
    id: crypto.randomUUID(),
    file,
    type,
    previewUrl: URL.createObjectURL(file),
    position: { x: 50, y: 50 },
    zoom: 1,
    filterPreset: 'none',
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  }
}
