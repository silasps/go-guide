'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Highlight, Milestone, ProjectBudgetCategory, ProjectGalleryImage, ProjectPrayerPoint, MediaAspectRatio } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Trash2, ImagePlus } from 'lucide-react'
import { toMasked, fromMasked, reformatMasked, CURRENCIES } from '@/lib/currency-mask'
import { uniqueFileName } from './cover-editor'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'
import { createMediaDraft, resolveCssFilter, type MediaDraft } from '@/components/shared/media-editor/types'
import { bakeImage } from '@/lib/media/bake-image'
import { compressImage, getMediaType } from '@/lib/media/compress'
import { uploadVideoToBunny } from '@/lib/media/upload-bunny-video'
import { MilestonesEditor, type MilestoneDraft } from './milestones-editor'
import { BudgetCategoriesEditor, type BudgetCategoryDraft } from './budget-categories-editor'
import { PrayerPointsEditor, type PrayerPointDraft } from './prayer-points-editor'
import { GalleryEditor, type GalleryImageDraft } from './gallery-editor'
import { DeleteProjectDialog } from './delete-project-dialog'
import { SupportTypesPicker } from './support-types-picker'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { PROJECT_CATEGORIES } from '@/lib/highlights/project-categories'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent } from '@/lib/i18n/content-translations'

interface Props {
  highlight?: Highlight & { milestones?: Milestone[]; budgetCategories?: ProjectBudgetCategory[]; galleryImages?: ProjectGalleryImage[]; prayerPoints?: ProjectPrayerPoint[] }
  profileId: string
  backPath?: string
}

export function HighlightForm({ highlight, profileId, backPath = '/dashboard/projetos' }: Props) {
  const tDelete = useTranslations('DeleteProjectDialog')
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
  // Capa nova selecionada (ainda não salva) — mesmo componente/formato do
  // composer de post e do wizard de "novo projeto" (ImageCropEditor:
  // zoom por pinça/roda/botões + arrastar livre), pedido do usuário. Capa
  // já salva (`coverPreview`) fica só como prévia estática até o usuário
  // trocar por uma nova — reeditar o recorte da capa atual é só escolher
  // o mesmo arquivo de novo, evita ter que rebaixar uma URL remota pra
  // File só pra reabrir o editor nela.
  const [coverMedia, setCoverMedia] = useState<MediaDraft | null>(null)
  const [coverAspect] = useState<MediaAspectRatio>('1.91:1')
  const [coverPreview, setCoverPreview] = useState<string>(highlight?.cover_url ?? '')
  const [coverMediaType, setCoverMediaType] = useState<'image' | 'video'>(highlight?.cover_media_type ?? 'image')
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [tripStartDate, setTripStartDate] = useState(highlight?.trip_start_date ?? '')
  const [fundingDeadline, setFundingDeadline] = useState(highlight?.funding_deadline ?? '')
  const [scripture, setScripture] = useState(highlight?.scripture ?? '')
  const [letter, setLetter] = useState(highlight?.letter ?? '')
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
      prayerPoint: (highlight?.prayerPoints ?? []).find(p => p.budget_category_id === b.id)?.description ?? '',
    }))
  )
  const budgetTotal = budgetCategories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  // Só os pontos "soltos" (sem budget_category_id) ficam aqui — os
  // vinculados a uma necessidade financeira são editados inline em
  // BudgetCategoriesEditor (campo prayerPoint) e recriados a cada save a
  // partir de lá, não fazem parte desta lista.
  const [prayerPoints, setPrayerPoints] = useState<PrayerPointDraft[]>(
    (highlight?.prayerPoints ?? [])
      .filter(p => !p.budget_category_id)
      .map(p => ({ id: p.id, title: p.title, description: p.description ?? '', is_completed: p.is_completed }))
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

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
          // Recorte já vem "assado" no pixel da imagem — sem sobra pra
          // reposicionar via CSS, ao contrário da foto original.
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
                    prayerPoint: b.prayerPoint?.trim() || null,
                  }))
              : [],
            // Pontos "soltos" (sem necessidade financeira vinculada) — só
            // fazem sentido salvar quando "Apoio de oração" está habilitado;
            // os vinculados vêm junto de cada budgetCategories[i].prayerPoint.
            prayerPoints: goalTypes.includes('prayer')
              ? prayerPoints.filter(p => p.title.trim()).map(p => ({ title: p.title.trim(), description: p.description.trim() || null, is_completed: p.is_completed }))
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

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Desktop: 2 columns. Mobile: single column. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">

        {/* ── Coluna esquerda: campos primários ── */}
        <div className="space-y-5">
          {/* Cover */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Capa</Label>
              <span className="text-xs text-muted-foreground">1200 × 630 px recomendado</span>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const type = getMediaType(file)
                if (type === 'unknown') return
                setCoverMedia(createMediaDraft(file, type))
                setCoverMediaType(type)
              }}
            />

            {coverMedia ? (
              coverMedia.type === 'video' ? (
                <video src={coverMedia.previewUrl} controls className="w-full aspect-[1.91/1] rounded-lg bg-black object-cover" />
              ) : (
                <ImageCropEditor
                  media={coverMedia}
                  aspect={coverAspect}
                  onAspectChange={() => {}}
                  onPositionChange={(pos) => setCoverMedia((prev) => (prev ? { ...prev, position: pos } : prev))}
                  onZoomChange={(zoom) => setCoverMedia((prev) => (prev ? { ...prev, zoom } : prev))}
                  showAspectPicker={false}
                />
              )
            ) : coverPreview ? (
              <div className="relative w-full aspect-[1.91/1] rounded-lg overflow-hidden bg-muted">
                {coverMediaType === 'video' ? (
                  <video src={coverPreview} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Image src={coverPreview} alt="Capa" fill className="object-cover" style={{ objectPosition: highlight?.cover_position ?? '50% 50%' }} />
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full aspect-[1.91/1] rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ImagePlus className="h-7 w-7" />
                <span className="text-sm">Clique para adicionar capa (foto ou vídeo)</span>
              </button>
            )}

            {(coverMedia || coverPreview) && (
              <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                Trocar capa
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <LocaleContentTabs
              originalLocale={originalLocale}
              originalText={title}
              onOriginalChange={setTitle}
              translations={titleTranslations}
              onTranslationChange={(locale, value) => { setTitleTranslations((prev) => ({ ...prev, [locale]: value })); setTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
              onTranslateWithAi={(locale) => translateField(title, locale, setTitleTranslations, setTitleSources)}
              originalPlaceholder="Ex: Construção da Base em Moçambique"
              rows={1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <LocaleContentTabs
              originalLocale={originalLocale}
              originalText={description}
              onOriginalChange={setDescription}
              translations={descTranslations}
              onTranslationChange={(locale, value) => { setDescTranslations((prev) => ({ ...prev, [locale]: value })); setDescSources((prev) => ({ ...prev, [locale]: 'human' })) }}
              onTranslateWithAi={(locale) => translateField(description, locale, setDescTranslations, setDescSources)}
              originalPlaceholder="Descreva o projeto e seu impacto..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="trip_start_date">Data da viagem</Label>
              <Input id="trip_start_date" type="date" value={tripStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTripStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funding_deadline">Prazo para bater a meta</Label>
              <Input id="funding_deadline" type="date" value={fundingDeadline} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFundingDeadline(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Como os parceiros podem ajudar?</Label>
            <p className="text-xs text-muted-foreground">Selecione uma ou mais formas de apoio para este projeto.</p>
            <SupportTypesPicker selected={goalTypes} onChange={setGoalTypes} />
          </div>

          <div className="space-y-2">
            <Label>Categoria do projeto</Label>
            <p className="text-xs text-muted-foreground">Ajuda a mostrar este projeto para parceiros com afinidade pelo assunto. Opcional.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {PROJECT_CATEGORIES.map(({ value, emoji, label }) => {
                const selected = categories.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategories(prev =>
                      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
                    )}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                      selected
                        ? 'border-primary bg-primary/8 text-foreground font-medium'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{emoji}</span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {goalTypes.includes('financial') && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="currency">Moeda</Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {budgetMode === 'single' && (
                  <div className="space-y-2">
                    <Label htmlFor="goal">Meta</Label>
                    <Input
                      id="goal"
                      inputMode="numeric"
                      value={goalAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoalAmount(toMasked(e.target.value, currency))}
                      placeholder="0,00"
                    />
                  </div>
                )}
                {budgetMode === 'single' && (
                  <div className="space-y-2">
                    <Label htmlFor="current">Arrecadado</Label>
                    <Input
                      id="current"
                      inputMode="numeric"
                      value={currentAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentAmount(toMasked(e.target.value, currency))}
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>

              <BudgetCategoriesEditor
                currency={currency}
                mode={budgetMode}
                onModeChange={setBudgetMode}
                categories={budgetCategories}
                onChange={setBudgetCategories}
              />
            </div>
          )}

          {goalTypes.includes('prayer') && (
            <div className="space-y-2">
              <Label>Pontos de oração</Label>
              <p className="text-xs text-muted-foreground">Opcional — ajuda parceiros a orar por algo específico, em vez de só “orar pelo projeto”.</p>
              <PrayerPointsEditor points={prayerPoints} onChange={setPrayerPoints} />
            </div>
          )}
        </div>

        {/* ── Coluna direita: contexto e configurações ── */}
        <div className="space-y-5">
          {/* Status — só em edição */}
          {highlight && (
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                {([
                  { value: 'active',    label: '🟢 Ativo' },
                  { value: 'completed', label: '✅ Concluído' },
                  { value: 'hidden',    label: '🔒 Oculto' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={`flex-1 py-2 px-2 rounded-lg border text-xs transition-colors ${
                      status === value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Versículo */}
          <div className="space-y-2">
            <Label htmlFor="scripture">Versículo / palavra</Label>
            <LocaleContentTabs
              originalLocale={originalLocale}
              originalText={scripture}
              onOriginalChange={setScripture}
              translations={scriptureTranslations}
              onTranslationChange={(locale, value) => { setScriptureTranslations((prev) => ({ ...prev, [locale]: value })); setScriptureSources((prev) => ({ ...prev, [locale]: 'human' })) }}
              onTranslateWithAi={(locale) => translateField(scripture, locale, setScriptureTranslations, setScriptureSources)}
              originalPlaceholder="Ex: Jeremias 29:11 — Porque eu sei os planos que tenho para vós..."
              rows={3}
            />
          </div>

          {/* Carta */}
          <div className="space-y-2">
            <Label htmlFor="letter">A história por trás deste projeto</Label>
            <p className="text-xs text-muted-foreground">Conte o que Deus falou, por que isso importa e como surgiu. Tanto novos visitantes quanto parceiros antigos vão ler isso.</p>
            <LocaleContentTabs
              originalLocale={originalLocale}
              originalText={letter}
              onOriginalChange={setLetter}
              translations={letterTranslations}
              onTranslationChange={(locale, value) => { setLetterTranslations((prev) => ({ ...prev, [locale]: value })); setLetterSources((prev) => ({ ...prev, [locale]: 'human' })) }}
              onTranslateWithAi={(locale) => translateField(letter, locale, setLetterTranslations, setLetterSources)}
              originalPlaceholder="Queridos amigos e parceiros..."
              rows={8}
            />
          </div>

          {/* Marcos */}
          <div className="space-y-3">
            <Label>Marcos do projeto</Label>
            <MilestonesEditor milestones={milestones} onChange={setMilestones} originalLocale={originalLocale} profileId={profileId} />
          </div>

          {/* Galeria de fotos — imagens avulsas que representam o projeto,
              separadas da capa única e dos posts vinculados ao projeto. */}
          <div className="space-y-3">
            <Label>Fotos do projeto</Label>
            <GalleryEditor images={galleryImages} onChange={setGalleryImages} />
          </div>
        </div>
      </div>

      {/* Botões — fora do grid, abaixo das duas colunas */}
      <div className="flex items-center gap-3 pt-2 border-t">
        {highlight && (
          <Button type="button" variant="ghost" className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {tDelete('confirmDelete')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.push(backPath)}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {highlight ? 'Salvar alterações' : 'Criar projeto'}
        </Button>
      </div>

      {highlight && (
        <DeleteProjectDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          projectId={highlight.id}
          projectTitle={highlight.title}
          onDeleted={() => { router.push(backPath); router.refresh() }}
        />
      )}
    </form>
  )
}
