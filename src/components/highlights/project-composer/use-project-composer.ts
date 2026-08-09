'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { toast } from 'sonner'
import { fromMasked, reformatMasked, CURRENCIES } from '@/lib/currency-mask'
import { uniqueFileName } from '@/components/highlights/cover-editor'
import { compressImage } from '@/lib/media/compress'
import { bakeImage } from '@/lib/media/bake-image'
import { resolveCssFilter, type MediaDraft } from '@/components/shared/media-editor/types'
import type { MilestoneDraft } from '@/components/highlights/milestones-editor'
import type { BudgetCategoryDraft } from '@/components/highlights/budget-categories-editor'
import { GOAL_TYPE_OPTIONS } from '@/components/highlights/support-types-picker'
import type { MediaAspectRatio } from '@/types/database'
import type { Locale } from '@/i18n/config'

export type ProjectComposerStep = 'cover' | 'adjust' | 'goal' | 'story'

interface Options {
  profileId: string
  onSaved: () => void
}

/** Mesma lógica de estado/salvamento de `HighlightForm` (usada na edição),
 *  só reorganizada em passos pro wizard fullscreen — mesmo endpoint
 *  `POST /api/highlights`, sem duplicar a rota nem os sub-editores. */
export function useProjectComposer({ profileId, onSaved }: Options) {
  const router = useRouter()
  const t = useTranslations('ProjectComposer')
  const { isPending: saving, run } = usePendingAction()

  const [step, setStep] = useState<ProjectComposerStep>('cover')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [originalLocale] = useState<Locale>('pt')
  const [titleTranslations, setTitleTranslations] = useState<Partial<Record<Locale, string>>>({})
  const [titleSources, setTitleSources] = useState<Partial<Record<Locale, 'ai' | 'human'>>>({})
  const [descTranslations, setDescTranslations] = useState<Partial<Record<Locale, string>>>({})
  const [descSources, setDescSources] = useState<Partial<Record<Locale, 'ai' | 'human'>>>({})

  async function translateField(
    text: string, locale: Locale,
    setTranslations: React.Dispatch<React.SetStateAction<Partial<Record<Locale, string>>>>,
    setSources: React.Dispatch<React.SetStateAction<Partial<Record<Locale, 'ai' | 'human'>>>>
  ) {
    if (!text.trim()) return
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, sourceLocale: originalLocale, targetLocales: [locale], text }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(t('saveError')); return }
      const translated = data.translations?.[locale]
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch {
      toast.error(t('saveError'))
    }
  }
  // Todas as formas de apoio já marcadas por padrão — o missionário desmarca
  // as que não se aplicam, em vez de precisar lembrar de marcar cada uma.
  const [goalTypes, setGoalTypes] = useState<string[]>(GOAL_TYPE_OPTIONS.map((o) => o.value))
  const [categories, setCategories] = useState<string[]>([])
  const [currency, setCurrency] = useState(CURRENCIES[0])
  const [goalAmount, setGoalAmount] = useState('')
  const [coverMedia, setCoverMedia] = useState<MediaDraft | null>(null)
  const [coverAspect, setCoverAspect] = useState<MediaAspectRatio>('16:9')
  const [tripStartDate, setTripStartDate] = useState('')
  const [fundingDeadline, setFundingDeadline] = useState('')
  const [scripture, setScripture] = useState('')
  const [letter, setLetter] = useState('')
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([])
  const [budgetMode, setBudgetMode] = useState<'single' | 'detailed'>('single')
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryDraft[]>([])
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  const budgetTotal = budgetCategories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  function handleCurrencyChange(newCurrency: string) {
    setGoalAmount((prev) => reformatMasked(prev, currency, newCurrency))
    setBudgetCategories((prev) => prev.map((b) => ({ ...b, target_amount: reformatMasked(b.target_amount, currency, newCurrency) })))
    setCurrency(newCurrency)
  }

  const hasUnsavedContent = title.trim().length > 0 || description.trim().length > 0 || !!coverMedia

  function requestClose(close: () => void) {
    if (hasUnsavedContent) setDiscardConfirmOpen(true)
    else close()
  }

  function handleSave() {
    if (!title.trim()) { toast.error(t('titleRequiredError')); return }

    run(true, async () => {
      try {
        const supabase = createClient()
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        let cover_url: string | null = null

        if (coverMedia) {
          // Mesmo pipeline do composer de post: recorte/zoom/filtro escolhidos
          // na tela já saem "assados" no arquivo final (canvas), então não
          // precisa guardar crop separado — cover_position fica sempre centro.
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
        }

        const cover_position = '50% 50%'
        const types = goalTypes.length > 0 ? goalTypes : ['ongoing']
        const hasFinancial = types.includes('financial')
        const isDetailedBudget = hasFinancial && budgetMode === 'detailed'

        const buildTranslations = (translations: Partial<Record<Locale, string>>, sources: Partial<Record<Locale, 'ai' | 'human'>>) =>
          Object.fromEntries(
            Object.entries(translations)
              .filter(([locale, text]) => locale !== originalLocale && text?.trim())
              .map(([locale, text]) => [locale, { content: text!.trim(), source: sources[locale as Locale] ?? 'human', translated_at: new Date().toISOString() }])
          )

        const res = await fetch('/api/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId,
            title: title.trim(),
            description: description.trim(),
            originalLocale,
            titleTranslations: buildTranslations(titleTranslations, titleSources),
            descriptionTranslations: buildTranslations(descTranslations, descSources),
            goalTypes,
            category: categories,
            goalAmount: isDetailedBudget ? budgetTotal : (hasFinancial && goalAmount ? parseFloat(fromMasked(goalAmount, currency)) : null),
            currentAmount: 0,
            currency,
            coverUrl: cover_url,
            coverPosition: cover_position,
            tripStartDate: tripStartDate || null,
            fundingDeadline: fundingDeadline || null,
            scripture: scripture.trim(),
            letter: letter.trim(),
            status: 'active',
            milestones,
            budgetCategories: isDetailedBudget
              ? budgetCategories
                  .filter((b) => parseFloat(fromMasked(b.target_amount, currency)) > 0)
                  .map((b) => ({
                    category_type: b.category_type,
                    custom_label: b.category_type === 'other' ? (b.custom_label.trim() || 'Outros') : null,
                    description: b.description.trim() || null,
                    target_amount: parseFloat(fromMasked(b.target_amount, currency)),
                  }))
              : [],
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? t('saveError'))
        }

        toast.success(t('projectCreated'))
        router.push('/dashboard/projetos')
        router.refresh()
        onSaved()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('saveError'))
      }
    })
  }

  return {
    step, setStep,
    title, setTitle,
    description, setDescription,
    originalLocale,
    titleTranslations, setTitleTranslations, titleSources, setTitleSources,
    descTranslations, setDescTranslations, descSources, setDescSources,
    translateField,
    goalTypes, setGoalTypes,
    categories, setCategories,
    currency, handleCurrencyChange,
    goalAmount, setGoalAmount,
    coverMedia, setCoverMedia,
    coverAspect, setCoverAspect,
    tripStartDate, setTripStartDate,
    fundingDeadline, setFundingDeadline,
    scripture, setScripture,
    letter, setLetter,
    milestones, setMilestones,
    budgetMode, setBudgetMode,
    budgetCategories, setBudgetCategories,
    discardConfirmOpen, setDiscardConfirmOpen,
    requestClose,
    saving,
    handleSave,
  }
}
