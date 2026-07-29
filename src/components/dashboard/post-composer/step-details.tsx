'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { MapPin, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { PostEditorProjectPicker } from '@/components/dashboard/post-editor-project-picker'
import { getLocationSuggestions } from '@/app/dashboard/publicacoes/actions'
import type { usePostComposer } from './use-post-composer'
import { TagPeoplePicker } from './tag-people-picker'

interface Props {
  composer: ReturnType<typeof usePostComposer>
  profileId: string
}

export function StepDetails({ composer, profileId }: Props) {
  const t = useTranslations('PostComposer')
  const {
    content, setContent, translations, setTranslations, setTranslationSources,
    handleTranslateWithAi, effectiveOriginalLocale,
    existingUrls, removeExistingUrl, mediaFiles, activeIndex, setActiveIndex, aspect, tags, setTags,
    location, setLocation, projectId, setProjectId,
    scheduleEnabled, setScheduleEnabled, scheduledAt, setScheduledAt,
    uploadProgress, saving, handleSave,
  } = composer

  const taggableMedia = mediaFiles[activeIndex]
  const absoluteMediaIndex = existingUrls.length + activeIndex

  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  useEffect(() => {
    getLocationSuggestions(profileId).then(setLocationSuggestions).catch(() => {})
  }, [profileId])

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <LocaleContentTabs
        originalLocale={effectiveOriginalLocale}
        originalText={content}
        onOriginalChange={setContent}
        translations={translations}
        onTranslationChange={(locale, value) => {
          setTranslations((prev) => ({ ...prev, [locale]: value }))
          setTranslationSources((prev) => ({ ...prev, [locale]: 'human' }))
        }}
        onTranslateWithAi={handleTranslateWithAi}
        originalPlaceholder={t('placeholder')}
        textareaClassName="border-0 px-0 shadow-none focus-visible:ring-0 text-base min-h-24"
      />

      {existingUrls.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          {existingUrls.map((url, i) => (
            <div key={url + i} className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
              <Image src={url} alt="" fill className="object-cover" />
              <button
                type="button"
                onClick={() => removeExistingUrl(i)}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {taggableMedia?.type === 'image' && (
        <div className="space-y-2">
          {mediaFiles.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {mediaFiles.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`h-10 w-10 shrink-0 rounded-md overflow-hidden ring-2 ${i === activeIndex ? 'ring-primary' : 'ring-transparent'}`}
                >
                  <Image src={m.previewUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <TagPeoplePicker
            profileId={profileId}
            media={taggableMedia}
            mediaIndex={absoluteMediaIndex}
            aspect={aspect}
            tags={tags}
            onAddTag={(tag) => setTags((prev) => [...prev, tag])}
            onRemoveTag={(id) => setTags((prev) => prev.filter((t) => t.id !== id))}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('locationPlaceholder')}
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        {locationSuggestions.filter((s) => s !== location).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-6">
            {locationSuggestions.filter((s) => s !== location).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setLocation(suggestion)}
                className="text-xs px-2 py-1 rounded-full border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <PostEditorProjectPicker profileId={profileId} value={projectId} onChange={setProjectId} />

      <div className="rounded-lg border p-3 space-y-2 overflow-hidden">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium">{t('scheduleToggle')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={scheduleEnabled}
            onClick={() => setScheduleEnabled(!scheduleEnabled)}
            className={`h-5 w-9 shrink-0 flex items-center rounded-full p-0.5 transition-colors ${scheduleEnabled ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}
          >
            <span className="h-4 w-4 rounded-full bg-white transition-transform" />
          </button>
        </label>
        {scheduleEnabled && (
          <Input
            type="datetime-local"
            className="w-full max-w-full"
            value={scheduledAt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        )}
      </div>

      {uploadProgress !== null && (
        <p className="text-xs text-muted-foreground">{t('uploadingMedia', { progress: uploadProgress })}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
          {t('saveDraft')}
        </Button>
        <Button type="button" onClick={() => handleSave('publish')} disabled={saving || (scheduleEnabled && !scheduledAt)}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {scheduleEnabled ? t('schedule') : t('publish')}
        </Button>
      </div>
    </div>
  )
}
