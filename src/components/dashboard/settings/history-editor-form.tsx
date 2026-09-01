'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import type { HistoryBlock } from '@/types/history'
import type { ContentTranslation } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { LOCALES, type Locale } from '@/i18n/config'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent, type TranslationSource } from '@/lib/i18n/content-translations'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, GripVertical, Languages } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const LOCALE_FLAGS: Record<Locale, string> = { pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸' }

type Translations = Partial<Record<Locale, ContentTranslation>>

interface TimelineItem {
  id: string
  year: string
  text: string
  translations: Partial<Record<Locale, string>>
  sources: Partial<Record<Locale, TranslationSource>>
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
  const [whoImageUrl, setWhoImageUrl] = useState((findBlock('who_we_are')?.content.image_url as string) ?? '')
  const [whoImageCaption, setWhoImageCaption] = useState((findBlock('who_we_are')?.content.image_caption as string) ?? '')

  const [callingTitle, setCallingTitle] = useState((findBlock('our_calling')?.content.title as string) ?? '')
  const [callingTitleTranslations, setCallingTitleTranslations] = useState(() => initialTranslations(translationsOf('our_calling', 'title')))
  const [callingTitleSources, setCallingTitleSources] = useState(() => initialSources(translationsOf('our_calling', 'title')))
  const [callingText, setCallingText] = useState((findBlock('our_calling')?.content.text as string) ?? '')
  const [callingTextTranslations, setCallingTextTranslations] = useState(() => initialTranslations(translationsOf('our_calling', 'text')))
  const [callingTextSources, setCallingTextSources] = useState(() => initialSources(translationsOf('our_calling', 'text')))
  const [callingImageUrl, setCallingImageUrl] = useState((findBlock('our_calling')?.content.image_url as string) ?? '')
  const [callingImageCaption, setCallingImageCaption] = useState((findBlock('our_calling')?.content.image_caption as string) ?? '')

  const [timelineTitle, setTimelineTitle] = useState((findBlock('timeline')?.content.title as string) ?? '')
  const [timelineTitleTranslations, setTimelineTitleTranslations] = useState(() => initialTranslations(translationsOf('timeline', 'title')))
  const [timelineTitleSources, setTimelineTitleSources] = useState(() => initialSources(translationsOf('timeline', 'title')))
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>(
    ((findBlock('timeline')?.content.items as { id?: string; year: string; text: string; text_translations?: Translations }[]) ?? []).map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      year: item.year,
      text: item.text,
      translations: initialTranslations(item.text_translations),
      sources: initialSources(item.text_translations),
    }))
  )
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

  function handleSave() {
    run(true, async () => {
      const supabase = createClient()
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
            image_url: whoImageUrl.trim() || undefined,
            image_caption: whoImageCaption.trim() || undefined,
          } : null,
        },
        {
          type: 'our_calling',
          content: callingText.trim() ? {
            title: callingTitle.trim() || undefined,
            title_translations: buildTranslations(callingTitleTranslations, callingTitleSources),
            text: callingText.trim(),
            text_translations: buildTranslations(callingTextTranslations, callingTextSources),
            image_url: callingImageUrl.trim() || undefined,
            image_caption: callingImageCaption.trim() || undefined,
          } : null,
        },
        {
          type: 'timeline',
          content: timelineItems.length ? {
            title: timelineTitle.trim() || undefined,
            title_translations: buildTranslations(timelineTitleTranslations, timelineTitleSources),
            items: timelineItems.map(({ id, year, text, translations, sources }) => ({
              id, year, text, text_translations: buildTranslations(translations, sources),
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

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{t('pageIntro')}</p>

      <section className="space-y-3">
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
          <Input
            value={whoImageUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWhoImageUrl(e.target.value)}
            placeholder={t('sectionImageUrlPlaceholder')}
          />
          {whoImageUrl.trim() && (
            <Input
              value={whoImageCaption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWhoImageCaption(e.target.value)}
              placeholder={t('sectionImageCaptionPlaceholder')}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
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
          <Input
            value={callingImageUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCallingImageUrl(e.target.value)}
            placeholder={t('sectionImageUrlPlaceholder')}
          />
          {callingImageUrl.trim() && (
            <Input
              value={callingImageCaption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCallingImageCaption(e.target.value)}
              placeholder={t('sectionImageCaptionPlaceholder')}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
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
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="grid grid-cols-[80px_1fr_auto] gap-2">
          <Input
            ref={newYearRef}
            value={newYear}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewYear(e.target.value)}
            placeholder={t('timelineYearPlaceholder')}
          />
          <Input
            value={newEventText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEventText(e.target.value)}
            placeholder={t('timelineEventPlaceholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTimelineItem() } }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addTimelineItem} aria-label={t('addItem')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="space-y-3">
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

function SortableTimelineItem({ item, originalLocale, translatingKey, onRemove, onTranslationChange, onTranslate, removeLabel, dragLabel, translateLabel, manualPlaceholder }: {
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }
  const [expanded, setExpanded] = useState(false)
  const targetLocales = LOCALES.filter((l) => l !== originalLocale)

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
        <span className="flex-1 text-muted-foreground">{item.text}</span>
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
