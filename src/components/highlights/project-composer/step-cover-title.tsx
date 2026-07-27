'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ImagePlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createMediaDraft } from '@/components/shared/media-editor/types'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'
import type { useProjectComposer } from './use-project-composer'

interface Props {
  composer: ReturnType<typeof useProjectComposer>
}

export function StepCoverTitle({ composer }: Props) {
  const t = useTranslations('ProjectComposer')
  const inputRef = useRef<HTMLInputElement>(null)
  const { title, setTitle, description, setDescription, coverMedia, setCoverMedia, coverAspect, setCoverAspect } = composer

  function handleFile(file: File | undefined) {
    if (!file) return
    setCoverMedia(createMediaDraft(file, 'image'))
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label>{t('coverLabel')}</Label>
          <span className="text-xs text-muted-foreground">{t('coverHint')}</span>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

        {coverMedia ? (
          <div className="space-y-2">
            <ImageCropEditor
              media={coverMedia}
              aspect={coverAspect}
              onAspectChange={setCoverAspect}
              onPositionChange={(position) => setCoverMedia((prev) => (prev ? { ...prev, position } : prev))}
              onZoomChange={(zoom) => setCoverMedia((prev) => (prev ? { ...prev, zoom } : prev))}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {t('changeCover')}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full aspect-video rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImagePlus className="h-7 w-7" />
            <span className="text-sm">{t('selectCover')}</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">{t('titleLabel')}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('descriptionLabel')}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          rows={3}
        />
      </div>
    </div>
  )
}
