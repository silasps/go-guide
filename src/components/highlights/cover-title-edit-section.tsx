'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { CoverEditor, parsePosition, uniqueFileName } from './cover-editor'
import { uploadVideoToBunny } from '@/lib/media/upload-bunny-video'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent } from '@/lib/i18n/content-translations'
import type { Locale } from '@/i18n/config'
import type { SectionProps } from './section-types'

export function CoverTitleEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(snapshot.title)
  const [titleTranslations, setTitleTranslations] = useState(() => initialTranslations(snapshot.titleTranslations))
  const [titleSources, setTitleSources] = useState(() => initialSources(snapshot.titleTranslations))
  const [scripture, setScripture] = useState(snapshot.scripture)
  const [scriptureTranslations, setScriptureTranslations] = useState(() => initialTranslations(snapshot.scriptureTranslations))
  const [scriptureSources, setScriptureSources] = useState(() => initialSources(snapshot.scriptureTranslations))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState(snapshot.coverUrl ?? '')
  const [coverMediaType, setCoverMediaType] = useState<'image' | 'video'>(snapshot.coverMediaType)
  const [position, setPosition] = useState(parsePosition(snapshot.coverPosition || '50% 50%'))

  async function translateField(
    text: string, locale: Locale,
    setTranslations: React.Dispatch<React.SetStateAction<Partial<Record<Locale, string>>>>,
    setSources: React.Dispatch<React.SetStateAction<Partial<Record<Locale, 'ai' | 'human'>>>>
  ) {
    try {
      const translated = await translateContent(profileId, snapshot.originalLocale, locale, text)
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg === 'insufficient_ai_credits' ? t('insufficientAiCredits') : t('translateError'))
    }
  }

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionCover') })}
          onClick={() => {
            setTitle(snapshot.title)
            setTitleTranslations(initialTranslations(snapshot.titleTranslations))
            setTitleSources(initialSources(snapshot.titleTranslations))
            setScripture(snapshot.scripture)
            setScriptureTranslations(initialTranslations(snapshot.scriptureTranslations))
            setScriptureSources(initialSources(snapshot.scriptureTranslations))
            setCoverFile(null)
            setCoverPreview(snapshot.coverUrl ?? '')
            setCoverMediaType(snapshot.coverMediaType)
            setPosition(parsePosition(snapshot.coverPosition || '50% 50%'))
            setEditing(true)
          }}
        />
      </div>
    )
  }

  async function handleSave() {
    if (!title.trim()) return
    let coverUrl: string | null | undefined = snapshot.coverUrl
    let coverStatus = snapshot.coverStatus
    let coverBunnyVideoId = snapshot.coverBunnyVideoId

    if (coverFile && coverMediaType === 'video') {
      const { bunnyVideoId } = await uploadVideoToBunny(coverFile)
      coverUrl = undefined
      coverStatus = 'processing'
      coverBunnyVideoId = bunnyVideoId
    } else if (coverFile) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${user!.id}/highlights/${uniqueFileName('webp')}`
      const { error } = await supabase.storage.from('media').upload(path, coverFile, { upsert: true })
      if (error) return
      coverUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
      coverStatus = 'ready'
      coverBunnyVideoId = null
    }

    const ok = await save({
      ...snapshot,
      highlightId,
      profileId,
      title: title.trim(),
      titleTranslations: buildTranslationsPayload(snapshot.originalLocale, titleTranslations, titleSources),
      scripture: scripture.trim(),
      scriptureTranslations: buildTranslationsPayload(snapshot.originalLocale, scriptureTranslations, scriptureSources),
      coverUrl,
      coverPosition: `${Math.round(position.x)}% ${Math.round(position.y)}%`,
      coverMediaType,
      coverStatus,
      coverBunnyVideoId,
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <div className="space-y-1.5">
        <Label>Capa</Label>
        <CoverEditor
          initialUrl={coverPreview}
          initialPosition={position}
          initialMediaType={coverMediaType}
          onChange={(file, previewUrl, pos, mediaType) => {
            if (file) setCoverFile(file)
            setCoverPreview(previewUrl)
            setPosition(pos)
            setCoverMediaType(mediaType)
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <LocaleContentTabs
          originalLocale={snapshot.originalLocale}
          originalText={title}
          onOriginalChange={setTitle}
          translations={titleTranslations}
          onTranslationChange={(locale, value) => { setTitleTranslations((prev) => ({ ...prev, [locale]: value })); setTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => translateField(title, locale, setTitleTranslations, setTitleSources)}
          rows={1}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scripture">Versículo / palavra</Label>
        <LocaleContentTabs
          originalLocale={snapshot.originalLocale}
          originalText={scripture}
          onOriginalChange={setScripture}
          translations={scriptureTranslations}
          onTranslationChange={(locale, value) => { setScriptureTranslations((prev) => ({ ...prev, [locale]: value })); setScriptureSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => translateField(scripture, locale, setScriptureTranslations, setScriptureSources)}
          rows={3}
        />
      </div>
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
