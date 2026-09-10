'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Highlight, Milestone, ProjectBudgetCategory, ProjectGalleryImage, ProjectPrayerPoint, MediaAspectRatio } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { toMasked, fromMasked, reformatMasked } from '@/lib/currency-mask'
import { uniqueFileName } from './cover-editor'
import { resolveCssFilter, type MediaDraft } from '@/components/shared/media-editor/types'
import { bakeImage } from '@/lib/media/bake-image'
import { compressImage } from '@/lib/media/compress'
import { uploadVideoToBunny } from '@/lib/media/upload-bunny-video'
import type { MilestoneDraft } from './milestones-editor'
import type { BudgetCategoryDraft } from './budget-categories-editor'
import type { PrayerPointDraft } from './prayer-points-editor'
import type { GalleryImageDraft } from './gallery-editor'
import { toImageDraft, type ImageDraft } from './story-image-field'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent } from '@/lib/i18n/content-translations'

export type ProjectEditorStepId =
  | 'cover' | 'identity' | 'support-types' | 'schedule' | 'category'
  | 'financial' | 'financial-detailed' | 'prayer' | 'scripture' | 'letter'
  | 'milestones' | 'gallery'

export const STEP_LABELS: Record<ProjectEditorStepId, string> = {
  cover: 'Capa',
  identity: 'Identidade',
  'support-types': 'Formas de apoio',
  schedule: 'Cronograma',
  category: 'Categoria',
  financial: 'Meta financeira',
  'financial-detailed': 'Orçamento por categoria',
  prayer: 'Oração',
  scripture: 'Versículo',
  letter: 'Carta',
  milestones: 'Marcos',
  gallery: 'Galeria',
}

type HighlightWithRelations = Highlight & {
  milestones?: Milestone[]
  budgetCategories?: ProjectBudgetCategory[]
  galleryImages?: ProjectGalleryImage[]
  prayerPoints?: ProjectPrayerPoint[]
}

interface Options {
  mode: 'create' | 'edit'
  highlight?: HighlightWithRelations
  profileId: string
  backPath: string
  initialStepId?: ProjectEditorStepId
}

// Estado + motor de etapas do editor de projeto — reaproveitado tanto pela
// criação (passo a passo em tela cheia, terminando em "Revisão") quanto
// pela edição (abre direto em "Revisão", sem passar pelo passo a passo).
// Substitui highlight-form.tsx: mesmo estado, mesmo POST /api/highlights,
// só reorganizado em etapas — ver system.architecture.md §1-bis.
export function useProjectEditor({ mode, highlight, profileId, backPath, initialStepId }: Options) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [title, setTitle] = useState(highlight?.title ?? '')
  const [description, setDescription] = useState(highlight?.description ?? '')
  const [originalLocale] = useState<Locale>(highlight?.original_locale ?? 'pt')
  const [titleTranslations, setTitleTranslations] = useState(() => initialTranslations(highlight?.title_translations))
  const [titleSources, setTitleSources] = useState(() => initialSources(highlight?.title_translations))
  const [descTranslations, setDescTranslations] = useState(() => initialTranslations(highlight?.description_translations))
  const [descSources, setDescSources] = useState(() => initialSources(highlight?.description_translations))
  const [scriptureTranslations, setScriptureTranslations] = useState(() => initialTranslations(highlight?.scripture_translations))
  const [scriptureSources, setScriptureSources] = useState(() => initialSources(highlight?.scripture_translations))
  const [letterTranslations, setLetterTranslations] = useState(() => initialTranslations(highlight?.letter_translations))
  const [letterSources, setLetterSources] = useState(() => initialSources(highlight?.letter_translations))

  async function translateField(
    text: string, locale: Locale,
    setTranslations: React.Dispatch<React.SetStateAction<Partial<Record<Locale, string>>>>,
    setSources: React.Dispatch<React.SetStateAction<Partial<Record<Locale, 'ai' | 'human'>>>>
  ) {
    if (!text.trim()) return
    try {
      const translated = await translateContent(profileId, originalLocale, locale, text)
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg === 'insufficient_ai_credits' ? 'Créditos de IA insuficientes.' : 'Erro ao traduzir.')
    }
  }

  const [goalTypes, setGoalTypes] = useState<string[]>(
    Array.isArray(highlight?.goal_type) ? highlight.goal_type : ['financial']
  )
  const [categories, setCategories] = useState<string[]>(
    Array.isArray(highlight?.category) ? highlight.category : []
  )
  const initialCurrency = highlight?.currency ?? 'BRL'
  const [goalAmount, setGoalAmount] = useState(
    highlight?.goal_amount ? toMasked(String(Math.round(highlight.goal_amount * 100)), initialCurrency) : ''
  )
  const [currentAmount, setCurrentAmount] = useState(
    toMasked(String(Math.round((highlight?.current_amount ?? 0) * 100)), initialCurrency)
  )
  const [currency, setCurrency] = useState(initialCurrency)
  const [coverMedia, setCoverMedia] = useState<MediaDraft | null>(null)
  const [coverAspect] = useState<MediaAspectRatio>('1.91:1')
  const [coverPreview, setCoverPreview] = useState<string>(highlight?.cover_url ?? '')
  const [coverMediaType, setCoverMediaType] = useState<'image' | 'video'>(highlight?.cover_media_type ?? 'image')
  const [tripStartDate, setTripStartDate] = useState(highlight?.trip_start_date ?? '')
  const [fundingDeadline, setFundingDeadline] = useState(highlight?.funding_deadline ?? '')
  const [scripture, setScripture] = useState(highlight?.scripture ?? '')
  const [letter, setLetter] = useState(highlight?.letter ?? '')
  const [letterImage1, setLetterImage1] = useState<ImageDraft>(() => toImageDraft(highlight?.letter_image_url ?? null))
  const [letterImageCaption1, setLetterImageCaption1] = useState(highlight?.letter_image_caption ?? '')
  const [letterImage2, setLetterImage2] = useState<ImageDraft>(() => toImageDraft(highlight?.letter_image_url_2 ?? null))
  const [letterImageCaption2, setLetterImageCaption2] = useState(highlight?.letter_image_caption_2 ?? '')
  const [status, setStatus] = useState<'active' | 'hidden' | 'completed'>(
    (highlight?.status as 'active' | 'hidden' | 'completed') ?? 'active'
  )
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(
    (highlight?.milestones ?? []).map(m => ({
      id: m.id,
      title: m.title,
      is_completed: m.is_completed,
      translations: initialTranslations(m.title_translations),
      sources: initialSources(m.title_translations),
    }))
  )

  const [budgetMode, setBudgetMode] = useState<'single' | 'detailed'>(
    (highlight?.budgetCategories?.length ?? 0) > 0 ? 'detailed' : 'single'
  )
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryDraft[]>(
    (highlight?.budgetCategories ?? []).map(b => ({
      category_type: b.category_type,
      custom_label: b.custom_label ?? '',
      description: b.description ?? '',
      target_amount: toMasked(String(Math.round(b.target_amount * 100)), initialCurrency),
    }))
  )
  const budgetTotal = budgetCategories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  // Pontos de oração não têm vínculo com categoria de orçamento (removido
  // em 2026-09-08) — filtro por !p.budget_category_id só ignora linhas
  // legadas, nenhuma nova é criada com vínculo.
  const [prayerPoints, setPrayerPoints] = useState<PrayerPointDraft[]>(
    (highlight?.prayerPoints ?? [])
      .filter(p => !p.budget_category_id)
      .map(p => ({
        id: p.id,
        title: p.title,
        description: p.description ?? '',
        is_completed: p.is_completed,
        titleTranslations: initialTranslations(p.title_translations),
        titleSources: initialSources(p.title_translations),
        descriptionTranslations: initialTranslations(p.description_translations),
        descriptionSources: initialSources(p.description_translations),
      }))
  )

  const [galleryImages, setGalleryImages] = useState<GalleryImageDraft[]>(
    (highlight?.galleryImages ?? []).map(g => ({ url: g.image_url }))
  )

  function handleCurrencyChange(newCurrency: string) {
    setGoalAmount(prev => reformatMasked(prev, currency, newCurrency))
    setCurrentAmount(prev => reformatMasked(prev, currency, newCurrency))
    setBudgetCategories(prev => prev.map(b => ({ ...b, target_amount: reformatMasked(b.target_amount, currency, newCurrency) })))
    setCurrency(newCurrency)
  }

  // ── Motor de etapas ──
  const financialEnabled = goalTypes.includes('financial')
  const detailedBudget = financialEnabled && budgetMode === 'detailed'
  const prayerSectionShown = goalTypes.includes('prayer')

  const steps = useMemo<ProjectEditorStepId[]>(() => {
    const list: ProjectEditorStepId[] = ['cover', 'identity', 'support-types', 'schedule', 'category']
    if (financialEnabled) list.push('financial')
    if (detailedBudget) list.push('financial-detailed')
    if (prayerSectionShown) list.push('prayer')
    list.push('scripture', 'letter', 'milestones', 'gallery')
    return list
  }, [financialEnabled, detailedBudget, prayerSectionShown])

  const [rawStepId, setRawStepId] = useState<ProjectEditorStepId | 'review'>(() => {
    if (mode === 'edit') return 'review'
    return initialStepId && steps.includes(initialStepId) ? initialStepId : 'cover'
  })
  const isReview = rawStepId === 'review'
  // Se a etapa guardada sumir da lista dinâmica (ex.: estava em
  // "financial-detailed" e o próprio BudgetCategoriesEditor mudou o modo
  // pra "single"), computa na hora a etapa mais próxima ainda válida —
  // sem sincronizar via efeito, pra não disparar um setState extra a cada
  // render (o valor "corrigido" só é persistido de volta quando a pessoa
  // de fato navega, via goNext/goBack/setCurrentStepId).
  const currentStepId: ProjectEditorStepId | 'review' = isReview
    ? 'review'
    : (steps.includes(rawStepId as ProjectEditorStepId) ? rawStepId : (steps[steps.length - 1] ?? 'cover'))
  const currentIndex = isReview ? -1 : steps.indexOf(currentStepId as ProjectEditorStepId)

  function goNext() {
    if (currentIndex < steps.length - 1) setRawStepId(steps[currentIndex + 1])
    else setRawStepId('review')
  }
  function goBack() {
    if (isReview) { setRawStepId(steps[steps.length - 1]); return }
    if (currentIndex > 0) setRawStepId(steps[currentIndex - 1])
  }
  // Em modo edição, a única tela é "Revisão" (sem passo a passo antes) —
  // não há pra onde voltar. Em criação, sempre dá pra voltar, exceto na
  // primeiríssima etapa (aí o X fecha o editor).
  const canGoBack = isReview ? mode === 'create' : currentIndex > 0

  async function resolveLetterImageUrl(draft: ImageDraft, userId: string): Promise<string | null> {
    if (!draft.file) return draft.url.trim() || null
    const supabase = createClient()
    const path = `${userId}/highlights/${uniqueFileName('webp')}`
    const { error } = await supabase.storage.from('media').upload(path, draft.file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  function handleSubmit() {
    if (!title.trim()) { toast.error('Título obrigatório.'); return }
    if (!coverMedia && !coverPreview) { toast.error('Adicione uma foto de capa antes de salvar.'); return }

    run(true, async () => {
      try {
        const supabase = createClient()
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        let cover_url: string | null | undefined = highlight?.cover_url ?? null
        let cover_status: 'ready' | 'processing' = 'ready'
        let cover_bunny_video_id: string | null = highlight?.cover_bunny_video_id ?? null
        let cover_position = highlight?.cover_position ?? '50% 50%'

        if (coverMedia?.type === 'video') {
          const { bunnyVideoId } = await uploadVideoToBunny(coverMedia.file)
          cover_url = undefined
          cover_status = 'processing'
          cover_bunny_video_id = bunnyVideoId
          cover_position = '50% 50%'
        } else if (coverMedia) {
          const baked = await bakeImage({
            previewUrl: coverMedia.previewUrl,
            fileName: coverMedia.file.name,
            position: coverMedia.position,
            zoom: coverMedia.zoom,
            aspect: coverAspect,
            cssFilter: resolveCssFilter(coverMedia),
          })
          const compressed = await compressImage(baked)
          const path = `${currentUser!.id}/highlights/${uniqueFileName('webp')}`
          const { error } = await supabase.storage.from('media').upload(path, compressed, { upsert: true })
          if (error) throw error
          cover_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
          cover_bunny_video_id = null
          cover_position = '50% 50%'
        }

        const galleryUrls: string[] = []
        for (const img of galleryImages) {
          if (!img.file) { galleryUrls.push(img.url); continue }
          const path = `${currentUser!.id}/highlights/${uniqueFileName('webp')}`
          const { error } = await supabase.storage.from('media').upload(path, img.file, { upsert: true })
          if (error) throw error
          galleryUrls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
        }

        const [letterImageUrl, letterImageUrl2] = await Promise.all([
          resolveLetterImageUrl(letterImage1, currentUser!.id),
          resolveLetterImageUrl(letterImage2, currentUser!.id),
        ])
        if ((letterImage1.file && !letterImageUrl) || (letterImage2.file && !letterImageUrl2)) {
          throw new Error('Erro ao salvar imagem da carta.')
        }

        const types = goalTypes.length > 0 ? goalTypes : ['ongoing']
        const hasFinancial = types.includes('financial')
        const isDetailedBudget = hasFinancial && budgetMode === 'detailed'

        const buildTranslations = (translations: Partial<Record<Locale, string>>, sources: Partial<Record<Locale, 'ai' | 'human'>>) =>
          buildTranslationsPayload(originalLocale, translations, sources)

        const res = await fetch('/api/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            highlightId: highlight?.id,
            profileId,
            title: title.trim(),
            description: description.trim(),
            originalLocale,
            titleTranslations: buildTranslations(titleTranslations, titleSources),
            descriptionTranslations: buildTranslations(descTranslations, descSources),
            goalTypes,
            category: categories,
            goalAmount: isDetailedBudget ? budgetTotal : (hasFinancial && goalAmount ? parseFloat(fromMasked(goalAmount, currency)) : null),
            currentAmount: hasFinancial ? (parseFloat(fromMasked(currentAmount, currency)) || 0) : 0,
            currency,
            coverUrl: cover_url,
            coverPosition: cover_position,
            coverMediaType,
            coverStatus: cover_status,
            coverBunnyVideoId: cover_bunny_video_id,
            tripStartDate: tripStartDate || null,
            fundingDeadline: fundingDeadline || null,
            scripture: scripture.trim(),
            scriptureTranslations: buildTranslations(scriptureTranslations, scriptureSources),
            letter: letter.trim(),
            letterTranslations: buildTranslations(letterTranslations, letterSources),
            letterImageUrl,
            letterImageCaption: letterImageCaption1.trim() || null,
            letterImageUrl2,
            letterImageCaption2: letterImageCaption2.trim() || null,
            status,
            milestones: milestones.map(m => ({
              id: m.id,
              title: m.title,
              is_completed: m.is_completed,
              titleTranslations: buildTranslations(m.translations, m.sources),
            })),
            budgetCategories: isDetailedBudget
              ? budgetCategories
                  .filter(b => parseFloat(fromMasked(b.target_amount, currency)) > 0)
                  .map(b => ({
                    category_type: b.category_type,
                    custom_label: b.category_type === 'other' ? (b.custom_label.trim() || 'Outros') : null,
                    description: b.description.trim() || null,
                    target_amount: parseFloat(fromMasked(b.target_amount, currency)),
                  }))
              : [],
            prayerPoints: goalTypes.includes('prayer')
              ? prayerPoints.filter(p => p.title.trim()).map(p => ({
                  title: p.title.trim(),
                  titleTranslations: buildTranslations(p.titleTranslations, p.titleSources),
                  description: p.description.trim() || null,
                  descriptionTranslations: buildTranslations(p.descriptionTranslations, p.descriptionSources),
                  is_completed: p.is_completed,
                }))
              : [],
            galleryImages: galleryUrls,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Erro ao salvar')
        }

        toast.success(highlight ? 'Projeto atualizado.' : 'Projeto criado.')
        router.push(backPath)
        router.refresh()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar'
        toast.error(msg)
      }
    })
  }

  return {
    mode, highlight, backPath, router, saving,
    steps, currentStepId, setCurrentStepId: setRawStepId, isReview, currentIndex, canGoBack, goNext, goBack,
    handleSubmit,
    deleteDialogOpen, setDeleteDialogOpen,
    title, setTitle, description, setDescription, originalLocale,
    titleTranslations, setTitleTranslations, titleSources, setTitleSources,
    descTranslations, setDescTranslations, descSources, setDescSources,
    scriptureTranslations, setScriptureTranslations, scriptureSources, setScriptureSources,
    letterTranslations, setLetterTranslations, letterSources, setLetterSources,
    translateField,
    goalTypes, setGoalTypes, categories, setCategories,
    goalAmount, setGoalAmount, currentAmount, setCurrentAmount, currency, handleCurrencyChange,
    coverMedia, setCoverMedia, coverAspect, coverPreview, coverMediaType, setCoverMediaType,
    tripStartDate, setTripStartDate, fundingDeadline, setFundingDeadline,
    scripture, setScripture, letter, setLetter,
    letterImage1, setLetterImage1, letterImageCaption1, setLetterImageCaption1,
    letterImage2, setLetterImage2, letterImageCaption2, setLetterImageCaption2,
    status, setStatus, milestones, setMilestones,
    budgetMode, setBudgetMode, budgetCategories, setBudgetCategories, budgetTotal,
    prayerPoints, setPrayerPoints, galleryImages, setGalleryImages,
    financialEnabled, detailedBudget, prayerSectionShown,
    profileId,
  }
}

export type ProjectEditor = ReturnType<typeof useProjectEditor>
