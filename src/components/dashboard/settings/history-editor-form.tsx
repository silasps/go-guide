'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import type { HistoryBlock } from '@/types/history'
import type { ContentTranslation } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { LOCALES, type Locale } from '@/i18n/config'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent, type TranslationSource } from '@/lib/i18n/content-translations'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, GripVertical, Languages } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HistorySectionNav, type HistorySection } from '@/components/history/section-nav'
import { GalleryEditor, type GalleryImageDraft } from '@/components/highlights/gallery-editor'
import { uniqueFileName } from '@/components/highlights/cover-editor'
import { TimelinePostPicker, type PickablePost } from '@/components/history/timeline-post-picker'
import { compressImage } from '@/lib/media/compress'
import { ImagePlus, Link2 } from 'lucide-react'
import Image from 'next/image'

const LOCALE_FLAGS: Record<Locale, string> = { pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸' }

type Translations = Partial<Record<Locale, ContentTranslation>>

interface TimelineItem {
  id: string
  year: string
  text: string
  translations: Partial<Record<Locale, string>>
  sources: Partial<Record<Locale, TranslationSource>>
  postId?: string
  imageUrl?: string
}

interface Props {
  profileId: string
  blocks: HistoryBlock[]
  backPath: string
}

// Só os 4 tipos com um heading/formato conhecido pelo HistoryView — o 5º
// tipo ('text', um parágrafo solto sem título) é um fallback legado sem
// editor dedicado, não faz parte do fluxo normal de edição.
type EditableType = 'who_we_are' | 'our_calling' | 'timeline' | 'cta'

export function HistoryEditorForm({ profileId, blocks, backPath }: Props) {
  const t = useTranslations('HistoryEditor')
  const tLocale = useTranslations('LocaleContentTabs')
  const tError = useTranslations('PublicProject')
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()

  function findBlock(type: EditableType) {
    return blocks.find((b) => b.type === type)
  }

  function translationsOf(type: EditableType, field: 'title' | 'text') {
    return findBlock(type)?.content[`${field}_translations`] as Translations | undefined
  }

  // As 4 seções são editadas juntas nesse formulário único — um só idioma
  // original pro conjunto (herda do primeiro bloco já salvo, ou 'pt' se
  // ainda não há nenhum), já que não faria sentido cada seção ter um
  // idioma original diferente dentro do mesmo formulário.
  const [originalLocale] = useState<Locale>(blocks[0]?.original_locale ?? 'pt')
  const [translatingKey, setTranslatingKey] = useState<string | null>(null)

  const [whoTitle, setWhoTitle] = useState((findBlock('who_we_are')?.content.title as string) ?? '')
  const [whoTitleTranslations, setWhoTitleTranslations] = useState(() => initialTranslations(translationsOf('who_we_are', 'title')))
  const [whoTitleSources, setWhoTitleSources] = useState(() => initialSources(translationsOf('who_we_are', 'title')))
  const [whoText, setWhoText] = useState((findBlock('who_we_are')?.content.text as string) ?? '')
  const [whoTextTranslations, setWhoTextTranslations] = useState(() => initialTranslations(translationsOf('who_we_are', 'text')))
  const [whoTextSources, setWhoTextSources] = useState(() => initialSources(translationsOf('who_we_are', 'text')))
  const [whoImages, setWhoImages] = useState<GalleryImageDraft[]>(
    ((findBlock('who_we_are')?.content.images as string[]) ?? []).map((url) => ({ url }))
  )

  const [callingTitle, setCallingTitle] = useState((findBlock('our_calling')?.content.title as string) ?? '')
  const [callingTitleTranslations, setCallingTitleTranslations] = useState(() => initialTranslations(translationsOf('our_calling', 'title')))
  const [callingTitleSources, setCallingTitleSources] = useState(() => initialSources(translationsOf('our_calling', 'title')))
  const [callingText, setCallingText] = useState((findBlock('our_calling')?.content.text as string) ?? '')
  const [callingTextTranslations, setCallingTextTranslations] = useState(() => initialTranslations(translationsOf('our_calling', 'text')))
  const [callingTextSources, setCallingTextSources] = useState(() => initialSources(translationsOf('our_calling', 'text')))
  const [callingImages, setCallingImages] = useState<GalleryImageDraft[]>(
    ((findBlock('our_calling')?.content.images as string[]) ?? []).map((url) => ({ url }))
  )

  const [timelineTitle, setTimelineTitle] = useState((findBlock('timeline')?.content.title as string) ?? '')
  const [timelineTitleTranslations, setTimelineTitleTranslations] = useState(() => initialTranslations(translationsOf('timeline', 'title')))
  const [timelineTitleSources, setTimelineTitleSources] = useState(() => initialSources(translationsOf('timeline', 'title')))
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>(
    ((findBlock('timeline')?.content.items as { id?: string; year: string; text: string; text_translations?: Translations; post_id?: string; image_url?: string }[]) ?? []).map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      year: item.year,
      text: item.text,
      translations: initialTranslations(item.text_translations),
      sources: initialSources(item.text_translations),
      postId: item.post_id,
      imageUrl: item.image_url,
    }))
  )
  // Miniaturas dos posts já vinculados (carregadas na montagem) e do que for
  // vinculado agora na sessão — só pra pré-visualização no editor, nunca
  // persistido (o que é salvo é só o post_id).
  const [postThumbnails, setPostThumbnails] = useState<Record<string, PickablePost>>({})
  const [pickerForItemId, setPickerForItemId] = useState<string | null>(null)
  const [uploadingMediaFor, setUploadingMediaFor] = useState<string | null>(null)

  useEffect(() => {
    const postIds = [...new Set(timelineItems.map((i) => i.postId).filter((id): id is string => !!id))]
    if (postIds.length === 0) return
    const supabase = createClient()
    supabase.from('posts').select('id, media_urls, type').in('id', postIds).then(({ data }) => {
      if (!data) return
      setPostThumbnails((prev) => {
        const next = { ...prev }
        for (const post of data as PickablePost[]) next[post.id] = post
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [ctaTitle, setCtaTitle] = useState((findBlock('cta')?.content.title as string) ?? '')
  const [ctaTitleTranslations, setCtaTitleTranslations] = useState(() => initialTranslations(translationsOf('cta', 'title')))
  const [ctaTitleSources, setCtaTitleSources] = useState(() => initialSources(translationsOf('cta', 'title')))
  const [ctaText, setCtaText] = useState((findBlock('cta')?.content.text as string) ?? '')
  const [ctaTextTranslations, setCtaTextTranslations] = useState(() => initialTranslations(translationsOf('cta', 'text')))
  const [ctaTextSources, setCtaTextSources] = useState(() => initialSources(translationsOf('cta', 'text')))

  const [newYear, setNewYear] = useState('')
  const [newEventText, setNewEventText] = useState('')
  const newYearRef = useRef<HTMLInputElement>(null)

  function translateErrorMessage(err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    return msg === 'insufficient_ai_credits' ? tError('insufficientAiCredits') : tError('translateError')
  }

  async function translateField(
    text: string, locale: Locale,
    setTranslations: React.Dispatch<React.SetStateAction<Partial<Record<Locale, string>>>>,
    setSources: React.Dispatch<React.SetStateAction<Partial<Record<Locale, TranslationSource>>>>
  ) {
    if (!text.trim()) return
    try {
      const translated = await translateContent(profileId, originalLocale, locale, text)
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch (err: unknown) {
      toast.error(translateErrorMessage(err))
    }
  }

  function addTimelineItem() {
    if (!newYear.trim() || !newEventText.trim()) return
    setTimelineItems([...timelineItems, { id: crypto.randomUUID(), year: newYear.trim(), text: newEventText.trim(), translations: {}, sources: {} }])
    setNewYear('')
    setNewEventText('')
    newYearRef.current?.focus()
  }

  function removeTimelineItem(id: string) {
    setTimelineItems(timelineItems.filter((item) => item.id !== id))
  }

  function pickPostForItem(id: string, post: PickablePost) {
    setPostThumbnails((prev) => ({ ...prev, [post.id]: post }))
    setTimelineItems((items) => items.map((item) => item.id === id ? { ...item, postId: post.id, imageUrl: undefined } : item))
    setPickerForItemId(null)
  }

  async function uploadImageForItem(id: string, file: File) {
    setUploadingMediaFor(id)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const compressed = await compressImage(file)
      const path = `${authUser!.id}/historia/${uniqueFileName('webp')}`
      const { error } = await supabase.storage.from('media').upload(path, compressed, { upsert: true })
      if (error) throw error
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
      setTimelineItems((items) => items.map((item) => item.id === id ? { ...item, imageUrl: url, postId: undefined } : item))
    } finally {
      setUploadingMediaFor(null)
    }
  }

  function removeItemMedia(id: string) {
    setTimelineItems((items) => items.map((item) => item.id === id ? { ...item, postId: undefined, imageUrl: undefined } : item))
  }

  function setTimelineItemTranslation(id: string, locale: Locale, value: string) {
    setTimelineItems((items) => items.map((item) => item.id === id
      ? { ...item, translations: { ...item.translations, [locale]: value }, sources: { ...item.sources, [locale]: 'human' } }
      : item
    ))
  }

  async function translateTimelineItem(id: string, locale: Locale) {
    const item = timelineItems.find((i) => i.id === id)
    if (!item || !item.text.trim()) return
    setTranslatingKey(`${id}-${locale}`)
    try {
      const translated = await translateContent(profileId, originalLocale, locale, item.text)
      if (translated) {
        setTimelineItems((items) => items.map((i) => i.id === id
          ? { ...i, translations: { ...i.translations, [locale]: translated }, sources: { ...i.sources, [locale]: 'ai' } }
          : i
        ))
      }
    } catch (err: unknown) {
      toast.error(translateErrorMessage(err))
    } finally {
      setTranslatingKey(null)
    }
  }

  function handleTimelineDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTimelineItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  async function uploadGalleryImages(userId: string, images: GalleryImageDraft[]) {
    const supabase = createClient()
    const urls: string[] = []
    for (const img of images) {
      if (!img.file) { urls.push(img.url); continue }
      const path = `${userId}/historia/${uniqueFileName('webp')}`
      const { error } = await supabase.storage.from('media').upload(path, img.file, { upsert: true })
      if (error) throw error
      urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
    }
    return urls
  }

  function handleSave() {
    run(true, async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const [whoImageUrls, callingImageUrls] = await Promise.all([
        uploadGalleryImages(authUser!.id, whoImages),
        uploadGalleryImages(authUser!.id, callingImages),
      ])
      const buildTranslations = (translations: Partial<Record<Locale, string>>, sources: Partial<Record<Locale, TranslationSource>>) =>
        buildTranslationsPayload(originalLocale, translations, sources)

      // Seção sem conteúdo = bloco removido (não aparece mais na tela
      // pública), em vez de mostrar um cabeçalho vazio.
      const sections: { type: EditableType; content: Record<string, unknown> | null }[] = [
        {
          type: 'who_we_are',
          content: whoText.trim() ? {
            title: whoTitle.trim() || undefined,
            title_translations: buildTranslations(whoTitleTranslations, whoTitleSources),
            text: whoText.trim(),
            text_translations: buildTranslations(whoTextTranslations, whoTextSources),
            images: whoImageUrls.length ? whoImageUrls : undefined,
          } : null,
        },
        {
          type: 'our_calling',
          content: callingText.trim() ? {
            title: callingTitle.trim() || undefined,
            title_translations: buildTranslations(callingTitleTranslations, callingTitleSources),
            text: callingText.trim(),
            text_translations: buildTranslations(callingTextTranslations, callingTextSources),
            images: callingImageUrls.length ? callingImageUrls : undefined,
          } : null,
        },
        {
          type: 'timeline',
          content: timelineItems.length ? {
            title: timelineTitle.trim() || undefined,
            title_translations: buildTranslations(timelineTitleTranslations, timelineTitleSources),
            items: timelineItems.map(({ id, year, text, translations, sources, postId, imageUrl }) => ({
              id, year, text, text_translations: buildTranslations(translations, sources),
              post_id: postId || undefined, image_url: imageUrl || undefined,
            })),
          } : null,
        },
        {
          type: 'cta',
          content: ctaText.trim() ? {
            title: ctaTitle.trim() || undefined,
            title_translations: buildTranslations(ctaTitleTranslations, ctaTitleSources),
            text: ctaText.trim(),
            text_translations: buildTranslations(ctaTextTranslations, ctaTextSources),
          } : null,
        },
      ]

      for (const [index, section] of sections.entries()) {
        const existing = findBlock(section.type)
        if (!section.content) {
          if (existing) await supabase.from('history_blocks').delete().eq('id', existing.id)
          continue
        }
        if (existing) {
          await supabase.from('history_blocks').update({ content: section.content, order_index: index, original_locale: originalLocale }).eq('id', existing.id)
        } else {
          await supabase.from('history_blocks').insert({ profile_id: profileId, type: section.type, content: section.content, order_index: index, original_locale: originalLocale })
        }
      }

      toast.success(t('saved'))
      router.push(backPath)
      router.refresh()
    })
  }

  const galleryLabels = {
    addPhoto: (count: number, max: number) => t('addPhotoLabel', { count, max }),
    limitReached: (max: number) => t('photoLimitLabel', { max }),
    processing: t('processingPhotos'),
    limitToast: (max: number) => t('photoLimitToast', { max }),
  }

  const navSections: HistorySection[] = [
    { id: 'editor-who_we_are', label: t('whoWeAre') },
    { id: 'editor-our_calling', label: t('ourCalling') },
    { id: 'editor-timeline', label: t('timeline') },
    { id: 'editor-cta', label: t('cta') },
  ]

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{t('pageIntro')}</p>
      <HistorySectionNav sections={navSections} />

      <section id="editor-who_we_are" className="space-y-3 scroll-mt-16">
        <div>
          <h2 className="font-semibold text-sm">{t('whoWeAre')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('whoWeAreHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionTitle')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={whoTitle}
            onOriginalChange={setWhoTitle}
            translations={whoTitleTranslations}
            onTranslationChange={(locale, value) => { setWhoTitleTranslations((prev) => ({ ...prev, [locale]: value })); setWhoTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(whoTitle, locale, setWhoTitleTranslations, setWhoTitleSources)}
            rows={1}
            originalPlaceholder={t('whoWeAre')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionText')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={whoText}
            onOriginalChange={setWhoText}
            translations={whoTextTranslations}
            onTranslationChange={(locale, value) => { setWhoTextTranslations((prev) => ({ ...prev, [locale]: value })); setWhoTextSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(whoText, locale, setWhoTextTranslations, setWhoTextSources)}
            rows={4}
            textareaClassName="field-sizing-fixed resize-y"
            maxLength={600}
          />
        </div>
        <div className="space-y-1.5 rounded-lg border border-dashed p-3">
          <Label className="text-xs text-muted-foreground">{t('sectionImageLabel')}</Label>
          <GalleryEditor images={whoImages} onChange={setWhoImages} labels={galleryLabels} />
        </div>
      </section>

      <section id="editor-our_calling" className="space-y-3 scroll-mt-16">
        <div>
          <h2 className="font-semibold text-sm">{t('ourCalling')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ourCallingHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionTitle')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={callingTitle}
            onOriginalChange={setCallingTitle}
            translations={callingTitleTranslations}
            onTranslationChange={(locale, value) => { setCallingTitleTranslations((prev) => ({ ...prev, [locale]: value })); setCallingTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(callingTitle, locale, setCallingTitleTranslations, setCallingTitleSources)}
            rows={1}
            originalPlaceholder={t('ourCalling')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionText')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={callingText}
            onOriginalChange={setCallingText}
            translations={callingTextTranslations}
            onTranslationChange={(locale, value) => { setCallingTextTranslations((prev) => ({ ...prev, [locale]: value })); setCallingTextSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(callingText, locale, setCallingTextTranslations, setCallingTextSources)}
            rows={4}
            textareaClassName="field-sizing-fixed resize-y"
            maxLength={600}
          />
        </div>
        <div className="space-y-1.5 rounded-lg border border-dashed p-3">
          <Label className="text-xs text-muted-foreground">{t('sectionImageLabel')}</Label>
          <GalleryEditor images={callingImages} onChange={setCallingImages} labels={galleryLabels} />
        </div>
      </section>

      <section id="editor-timeline" className="space-y-3 scroll-mt-16">
        <div>
          <h2 className="font-semibold text-sm">{t('timeline')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('timelineHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionTitle')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={timelineTitle}
            onOriginalChange={setTimelineTitle}
            translations={timelineTitleTranslations}
            onTranslationChange={(locale, value) => { setTimelineTitleTranslations((prev) => ({ ...prev, [locale]: value })); setTimelineTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(timelineTitle, locale, setTimelineTitleTranslations, setTimelineTitleSources)}
            rows={1}
            originalPlaceholder={t('timeline')}
          />
        </div>

        {timelineItems.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTimelineDragEnd}>
            <SortableContext items={timelineItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {timelineItems.map((item) => (
                  <SortableTimelineItem
                    key={item.id}
                    item={item}
                    originalLocale={originalLocale}
                    translatingKey={translatingKey}
                    onRemove={removeTimelineItem}
                    onTranslationChange={setTimelineItemTranslation}
                    onTranslate={translateTimelineItem}
                    removeLabel={t('removeItem')}
                    dragLabel={t('dragToReorder')}
                    translateLabel={tLocale('translateWithAi')}
                    manualPlaceholder={tLocale('manualPlaceholder')}
                    linkedPost={item.postId ? postThumbnails[item.postId] : undefined}
                    uploading={uploadingMediaFor === item.id}
                    onPickPost={() => setPickerForItemId(item.id)}
                    onUploadImage={(file) => uploadImageForItem(item.id, file)}
                    onRemoveMedia={() => removeItemMedia(item.id)}
                    linkPostLabel={t('timelineLinkPost')}
                    addPhotoLabel={t('timelineAddPhoto')}
                    removeMediaLabel={t('timelineRemoveMedia')}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <TimelinePostPicker
          profileId={profileId}
          open={pickerForItemId !== null}
          onOpenChange={(open) => !open && setPickerForItemId(null)}
          onSelect={(post) => pickerForItemId && pickPostForItem(pickerForItemId, post)}
          title={t('timelinePickerTitle')}
          emptyLabel={t('timelinePickerEmpty')}
        />

        <div className="grid grid-cols-[80px_1fr_auto] gap-2">
          <Input
            ref={newYearRef}
            value={newYear}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewYear(e.target.value)}
            placeholder={t('timelineYearPlaceholder')}
          />
          <Textarea
            value={newEventText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewEventText(e.target.value)}
            placeholder={t('timelineEventPlaceholder')}
            rows={1}
            className="field-sizing-fixed resize-y min-h-9"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTimelineItem() } }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addTimelineItem} aria-label={t('addItem')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section id="editor-cta" className="space-y-3 scroll-mt-16">
        <div>
          <h2 className="font-semibold text-sm">{t('cta')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ctaHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionTitle')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={ctaTitle}
            onOriginalChange={setCtaTitle}
            translations={ctaTitleTranslations}
            onTranslationChange={(locale, value) => { setCtaTitleTranslations((prev) => ({ ...prev, [locale]: value })); setCtaTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(ctaTitle, locale, setCtaTitleTranslations, setCtaTitleSources)}
            rows={1}
            originalPlaceholder={t('ctaTitlePlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('sectionText')}</Label>
          <LocaleContentTabs
            originalLocale={originalLocale}
            originalText={ctaText}
            onOriginalChange={setCtaText}
            translations={ctaTextTranslations}
            onTranslationChange={(locale, value) => { setCtaTextTranslations((prev) => ({ ...prev, [locale]: value })); setCtaTextSources((prev) => ({ ...prev, [locale]: 'human' })) }}
            onTranslateWithAi={(locale) => translateField(ctaText, locale, setCtaTextTranslations, setCtaTextSources)}
            rows={3}
            textareaClassName="field-sizing-fixed resize-y"
            originalPlaceholder={t('ctaTextPlaceholder')}
          />
        </div>
      </section>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('save')}
      </Button>
    </div>
  )
}

function SortableTimelineItem({ item, originalLocale, translatingKey, onRemove, onTranslationChange, onTranslate, removeLabel, dragLabel, translateLabel, manualPlaceholder, linkedPost, uploading, onPickPost, onUploadImage, onRemoveMedia, linkPostLabel, addPhotoLabel, removeMediaLabel }: {
  item: TimelineItem
  originalLocale: Locale
  translatingKey: string | null
  onRemove: (id: string) => void
  onTranslationChange: (id: string, locale: Locale, value: string) => void
  onTranslate: (id: string, locale: Locale) => void
  removeLabel: string
  dragLabel: string
  translateLabel: string
  manualPlaceholder: string
  linkedPost?: PickablePost
  uploading: boolean
  onPickPost: () => void
  onUploadImage: (file: File) => void
  onRemoveMedia: () => void
  linkPostLabel: string
  addPhotoLabel: string
  removeMediaLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }
  const [expanded, setExpanded] = useState(false)
  const targetLocales = LOCALES.filter((l) => l !== originalLocale)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailUrl = linkedPost ? linkedPost.media_urls[0] : item.imageUrl

  return (
    <li ref={setNodeRef} style={style} className="space-y-1.5 border rounded-lg p-2 bg-background">
      <div className="flex items-start gap-2 text-sm">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label={dragLabel}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="font-semibold text-primary shrink-0">{item.year}</span>
        <span className="flex-1 text-muted-foreground line-clamp-2">{item.text}</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`shrink-0 transition-colors ${expanded ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          title={translateLabel}
        >
          <Languages className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          aria-label={removeLabel}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="pl-6 flex items-center gap-2">
        {thumbnailUrl ? (
          <>
            <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted">
              {linkedPost?.type === 'video' ? (
                <video src={thumbnailUrl} className="h-full w-full object-cover" muted />
              ) : (
                <Image src={thumbnailUrl} alt="" fill sizes="2.5rem" className="object-cover" />
              )}
            </div>
            <button type="button" onClick={onRemoveMedia} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              {removeMediaLabel}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onPickPost} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Link2 className="h-3 w-3" />
              {linkPostLabel}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
              {addPhotoLabel}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadImage(file); e.target.value = '' }}
            />
          </>
        )}
      </div>

      {expanded && (
        <div className="pl-6 space-y-1.5">
          {targetLocales.map((locale) => (
            <div key={locale} className="flex items-center gap-1.5">
              <span className="text-xs shrink-0">{LOCALE_FLAGS[locale]}</span>
              <Input
                value={item.translations[locale] ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTranslationChange(item.id, locale, e.target.value)}
                placeholder={manualPlaceholder}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={!item.text.trim() || translatingKey !== null}
                onClick={() => onTranslate(item.id, locale)}
              >
                {translatingKey === `${item.id}-${locale}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
