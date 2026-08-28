import type { MediaAspectRatio } from '@/types/database'

export interface MediaAdjustments {
  brightness: number
  contrast: number
  saturate: number
  hueRotate: number
}

export const DEFAULT_ADJUSTMENTS: MediaAdjustments = { brightness: 100, contrast: 100, saturate: 100, hueRotate: 0 }

export type FilterPresetId =
  | 'none' | 'vivid' | 'warm' | 'cool' | 'mono' | 'fade'
  | 'crisp' | 'muted' | 'dramatic' | 'golden' | 'noir' | 'dreamy'

export const FILTER_PRESETS: { id: FilterPresetId; filter: string }[] = [
  { id: 'none', filter: '' },
  { id: 'vivid', filter: 'contrast(1.12) saturate(1.35)' },
  { id: 'warm', filter: 'sepia(0.25) saturate(1.2) contrast(1.05)' },
  { id: 'cool', filter: 'hue-rotate(-8deg) saturate(1.1) contrast(1.05)' },
  { id: 'mono', filter: 'grayscale(1) contrast(1.1)' },
  { id: 'fade', filter: 'contrast(0.9) saturate(0.85) brightness(1.05)' },
  { id: 'crisp', filter: 'contrast(1.2) saturate(1.1) brightness(1.02)' },
  { id: 'muted', filter: 'saturate(0.6) contrast(0.95) brightness(1.03)' },
  { id: 'dramatic', filter: 'contrast(1.3) brightness(0.92) saturate(1.15)' },
  { id: 'golden', filter: 'sepia(0.35) saturate(1.4) hue-rotate(-5deg) brightness(1.05)' },
  { id: 'noir', filter: 'grayscale(1) contrast(1.35) brightness(0.95)' },
  { id: 'dreamy', filter: 'brightness(1.08) contrast(0.88) saturate(0.85)' },
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
  /** Cor média da imagem, calculada uma vez (ver `averageColorFromUrl` em
   *  `bake-image.ts`) e reaproveitada como fundo em toda etapa do composer
   *  que mostra este preview (ajustar, marcar pessoas) — evita recalcular
   *  via `onLoad` de cada `<Image>`, que não dispara de forma confiável
   *  quando a blob URL já está em cache do navegador. `'#000'` até a conta
   *  assíncrona terminar (mesmo fallback do `ImageCropEditor`). */
  bgColor: string
}

/** Combina preset + sliders numa única string de filter CSS, usada tanto na
 *  preview ao vivo quanto para "assar" o filtro no canvas ao salvar. */
export function resolveCssFilter(media: Pick<MediaDraft, 'filterPreset' | 'adjustments'>): string {
  const preset = FILTER_PRESETS.find((p) => p.id === media.filterPreset)?.filter ?? ''
  const { brightness, contrast, saturate, hueRotate } = media.adjustments
  const adjustPart = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`
  return [preset, adjustPart].filter(Boolean).join(' ')
}

export const ASPECT_RATIO_CLASS: Record<MediaAspectRatio, string> = {
  original: '',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '1.91:1': 'aspect-[1.91/1]',
  '21:9': 'aspect-[21/9]',
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
    bgColor: '#000',
  }
}
