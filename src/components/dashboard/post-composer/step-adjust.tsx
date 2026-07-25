'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ASPECT_RATIO_CLASS, DEFAULT_ADJUSTMENTS, FILTER_PRESETS, resolveCssFilter, type MediaAdjustments, type MediaDraft } from './types'
import type { MediaAspectRatio } from '@/types/database'

type Tab = 'filters' | 'adjustments'

interface Props {
  mediaFiles: MediaDraft[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  aspect: MediaAspectRatio
  onChange: (index: number, patch: Partial<MediaDraft>) => void
}

const SLIDERS: { key: keyof MediaAdjustments; min: number; max: number }[] = [
  { key: 'brightness', min: 60, max: 140 },
  { key: 'contrast', min: 60, max: 140 },
  { key: 'saturate', min: 0, max: 200 },
  { key: 'hueRotate', min: -30, max: 30 },
]

export function StepAdjust({ mediaFiles, activeIndex, onActiveIndexChange, aspect, onChange }: Props) {
  const t = useTranslations('PostComposer')
  const [tab, setTab] = useState<Tab>('filters')
  const active = mediaFiles[activeIndex]
  if (!active) return null

  return (
    <div className="flex flex-col md:flex-row gap-4 md:h-[60vh]">
      <div className="shrink-0 md:w-1/2 md:h-full flex items-center justify-center bg-muted/30 rounded-lg">
        <div className={cn('relative w-full max-h-[45vh] md:max-h-full overflow-hidden rounded-lg', ASPECT_RATIO_CLASS[aspect] || 'aspect-[4/5]')}>
          {active.type === 'video' ? (
            <video src={active.previewUrl} className="w-full h-full object-cover" />
          ) : (
            <Image
              src={active.previewUrl}
              alt=""
              fill
              className="object-cover"
              style={{
                objectPosition: `${active.position.x}% ${active.position.y}%`,
                transform: `scale(${active.zoom})`,
                filter: resolveCssFilter(active) || undefined,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {mediaFiles.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {mediaFiles.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onActiveIndexChange(i)}
                className={cn('h-10 w-10 shrink-0 rounded-md overflow-hidden ring-2', i === activeIndex ? 'ring-primary' : 'ring-transparent')}
              >
                <Image src={m.previewUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 border-b">
          {(['filters', 'adjustments'] as Tab[]).map((tabId) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setTab(tabId)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === tabId ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t(tabId === 'filters' ? 'tabFilters' : 'tabAdjustments')}
            </button>
          ))}
        </div>

        {tab === 'filters' ? (
          <div className="grid grid-cols-3 gap-3">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(activeIndex, { filterPreset: preset.id })}
                className="space-y-1.5 text-center"
              >
                <div
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden ring-2',
                    active.filterPreset === preset.id ? 'ring-primary' : 'ring-transparent'
                  )}
                >
                  <Image src={active.previewUrl} alt="" fill className="object-cover" style={{ filter: preset.filter || undefined }} />
                </div>
                <span className="text-xs text-muted-foreground">{t(`filter_${preset.id}` as 'filter_none')}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {SLIDERS.map(({ key, min, max }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{t(`adjust_${key}` as 'adjust_brightness')}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onChange(activeIndex, { adjustments: { ...active.adjustments, [key]: DEFAULT_ADJUSTMENTS[key] } })}
                  >
                    {t('reset')}
                  </button>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={1}
                  value={active.adjustments[key]}
                  onChange={(e) => onChange(activeIndex, { adjustments: { ...active.adjustments, [key]: Number(e.target.value) } })}
                  className="w-full accent-primary"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
