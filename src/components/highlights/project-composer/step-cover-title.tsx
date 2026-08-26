'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ImagePlus } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { createMediaDraft } from '@/components/shared/media-editor/types'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'
import { getMediaType, validateVideo, validateVideoDuration } from '@/lib/media/compress'
import type { useProjectComposer } from './use-project-composer'

interface Props {
  composer: ReturnType<typeof useProjectComposer>
}

export function StepCoverTitle({ composer }: Props) {
  const t = useTranslations('ProjectComposer')
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    title, setTitle, description, setDescription, coverMedia, setCoverMedia, coverAspect, setCoverAspect,
    originalLocale, titleTranslations, setTitleTranslations, setTitleSources,
    descTranslations, setDescTranslations, setDescSources, translateField,
  } = composer

  async function handleFile(file: File | undefined) {
    if (!file) return
    const mediaType = getMediaType(file)
    if (mediaType === 'unknown') { toast.error(t('coverUnsupportedFormat')); return }
    if (mediaType === 'video') {
      const validation = validateVideo(file)
      if (!validation.valid) { toast.error(validation.error!); return }
      const durationCheck = await validateVideoDuration(file)
      if (!durationCheck.valid) { toast.error(durationCheck.error!); return }
    }
    setCoverMedia(createMediaDraft(file, mediaType))
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label>{t('coverLabel')}</Label>
          <span className="text-xs text-muted-foreground">{t('coverHint')}</span>
        </div>

        <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

        {coverMedia ? (
          <div className="space-y-2">
            {coverMedia.type === 'video' ? (
              <video src={coverMedia.previewUrl} controls className="w-full aspect-video rounded-lg bg-black object-cover" />
            ) : (
              <ImageCropEditor
                media={coverMedia}
                aspect={coverAspect}
                onAspectChange={setCoverAspect}
                onPositionChange={(position) => setCoverMedia((prev) => (prev ? { ...prev, position } : prev))}
                onZoomChange={(zoom) => setCoverMedia((prev) => (prev ? { ...prev, zoom } : prev))}
              />
            )}
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
        <LocaleContentTabs
          originalLocale={originalLocale}
          originalText={title}
          onOriginalChange={setTitle}
          translations={titleTranslations}
          onTranslationChange={(locale, value) => { setTitleTranslations((prev) => ({ ...prev, [locale]: value })); setTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => translateField(title, locale, setTitleTranslations, setTitleSources)}
          originalPlaceholder={t('titlePlaceholder')}
          rows={1}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('descriptionLabel')}</Label>
        <LocaleContentTabs
          originalLocale={originalLocale}
          originalText={description}
          onOriginalChange={setDescription}
          translations={descTranslations}
          onTranslationChange={(locale, value) => { setDescTranslations((prev) => ({ ...prev, [locale]: value })); setDescSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => translateField(description, locale, setDescTranslations, setDescSources)}
          originalPlaceholder={t('descriptionPlaceholder')}
          rows={3}
        />
      </div>
    </div>
  )
}
