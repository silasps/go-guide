'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2, ImagePlus } from 'lucide-react'
import { toMasked } from '@/lib/currency-mask'
import { CURRENCIES } from '@/lib/currency-mask'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'
import { createMediaDraft } from '@/components/shared/media-editor/types'
import { getMediaType } from '@/lib/media/compress'
import { MilestonesEditor } from './milestones-editor'
import { BudgetCategoriesEditor } from './budget-categories-editor'
import { PrayerPointsEditor } from './prayer-points-editor'
import { DeleteProjectDialog } from './delete-project-dialog'
import { SupportTypesPicker } from './support-types-picker'
import { StoryImageField } from './story-image-field'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { PROJECT_CATEGORIES } from '@/lib/highlights/project-categories'
import { WizardModal } from '@/components/shared/wizard-modal'
import { hasInAppNavigation } from '@/lib/navigation-tracker'
import { useProjectEditor, STEP_LABELS, type ProjectEditorStepId, type ProjectEditor } from './use-project-editor'
import type { Highlight, Milestone, ProjectBudgetCategory, ProjectPrayerPoint } from '@/types/database'

interface Props {
  mode: 'create' | 'edit'
  highlight?: Highlight & { milestones?: Milestone[]; budgetCategories?: ProjectBudgetCategory[]; prayerPoints?: ProjectPrayerPoint[] }
  profileId: string
  backPath: string
  initialStepId?: ProjectEditorStepId
}

// Card de seção numerada — mesmo idioma visual já usado no card financeiro
// da página pública (rounded-2xl border bg-card p-5), reaproveitado só na
// etapa "Revisão" (agrupa várias etapas juntas, editáveis).
function SectionCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{number}</span>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function StepCover({ e }: { e: ProjectEditor }) {
  const coverInputRef = useRef<HTMLInputElement>(null)
  return (
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
        onChange={(ev) => {
          const file = ev.target.files?.[0]
          if (!file) return
          const type = getMediaType(file)
          if (type === 'unknown') return
          e.setCoverMedia(createMediaDraft(file, type))
          e.setCoverMediaType(type)
        }}
      />
      {e.coverMedia ? (
        e.coverMedia.type === 'video' ? (
          <video src={e.coverMedia.previewUrl} controls className="w-full aspect-[1.91/1] rounded-lg bg-black object-cover" />
        ) : (
          <ImageCropEditor
            media={e.coverMedia}
            aspect={e.coverAspect}
            onAspectChange={() => {}}
            onPositionChange={(pos) => e.setCoverMedia((prev) => (prev ? { ...prev, position: pos } : prev))}
            onZoomChange={(zoom) => e.setCoverMedia((prev) => (prev ? { ...prev, zoom } : prev))}
            showAspectPicker={false}
          />
        )
      ) : e.coverPreview ? (
        <div className="relative w-full aspect-[1.91/1] rounded-lg overflow-hidden bg-muted">
          {e.coverMediaType === 'video' ? (
            <video src={e.coverPreview} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Image src={e.coverPreview} alt="Capa" fill className="object-cover" style={{ objectPosition: e.highlight?.cover_position ?? '50% 50%' }} />
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
      {(e.coverMedia || e.coverPreview) && (
        <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
          Trocar capa
        </Button>
      )}
    </div>
  )
}

function StepIdentity({ e }: { e: ProjectEditor }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <LocaleContentTabs
          originalLocale={e.originalLocale}
          originalText={e.title}
          onOriginalChange={e.setTitle}
          translations={e.titleTranslations}
          onTranslationChange={(locale, value) => { e.setTitleTranslations((prev) => ({ ...prev, [locale]: value })); e.setTitleSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => e.translateField(e.title, locale, e.setTitleTranslations, e.setTitleSources)}
          originalPlaceholder="Ex: Construção da Base em Moçambique"
          rows={1}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <LocaleContentTabs
          originalLocale={e.originalLocale}
          originalText={e.description}
          onOriginalChange={e.setDescription}
          translations={e.descTranslations}
          onTranslationChange={(locale, value) => { e.setDescTranslations((prev) => ({ ...prev, [locale]: value })); e.setDescSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => e.translateField(e.description, locale, e.setDescTranslations, e.setDescSources)}
          originalPlaceholder="Descreva o projeto e seu impacto..."
          rows={3}
        />
      </div>
    </>
  )
}

function StepSupportTypes({ e }: { e: ProjectEditor }) {
  return (
    <div className="space-y-2">
      <Label>Como os parceiros podem ajudar?</Label>
      <p className="text-xs text-muted-foreground">Selecione uma ou mais formas de apoio para este projeto.</p>
      <SupportTypesPicker selected={e.goalTypes} onChange={e.setGoalTypes} />
    </div>
  )
}

function StepSchedule({ e }: { e: ProjectEditor }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="trip_start_date">Data de início</Label>
        <Input id="trip_start_date" type="date" value={e.tripStartDate} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => e.setTripStartDate(ev.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="funding_deadline">Prazo para bater a meta</Label>
        <Input id="funding_deadline" type="date" value={e.fundingDeadline} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => e.setFundingDeadline(ev.target.value)} />
      </div>
    </div>
  )
}

function StepCategory({ e }: { e: ProjectEditor }) {
  return (
    <div className="space-y-2">
      <Label>Categoria do projeto</Label>
      <p className="text-xs text-muted-foreground">Ajuda a mostrar este projeto para parceiros com afinidade pelo assunto. Opcional.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {PROJECT_CATEGORIES.map(({ value, emoji, label }) => {
          const selected = e.categories.includes(value)
          return (
            <button
              key={value}
              type="button"
              onClick={() => e.setCategories(prev => prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value])}
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
  )
}

function StepFinancial({ e }: { e: ProjectEditor }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-1">
          <Label htmlFor="currency">Moeda</Label>
          <select
            id="currency"
            value={e.currency}
            onChange={(ev) => e.handleCurrencyChange(ev.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {e.budgetMode === 'single' && (
          <div className="space-y-2">
            <Label htmlFor="goal">Meta</Label>
            <Input
              id="goal"
              inputMode="numeric"
              value={e.goalAmount}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => e.setGoalAmount(toMasked(ev.target.value, e.currency))}
              placeholder="0,00"
            />
          </div>
        )}
        {e.budgetMode === 'single' && (
          <div className="space-y-2">
            <Label htmlFor="current">Arrecadado</Label>
            <Input
              id="current"
              inputMode="numeric"
              value={e.currentAmount}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => e.setCurrentAmount(toMasked(ev.target.value, e.currency))}
              placeholder="0,00"
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => e.setBudgetMode(e.budgetMode === 'single' ? 'detailed' : 'single')}
        className="text-xs text-primary hover:underline"
      >
        {e.budgetMode === 'single' ? 'Detalhar por categoria' : 'Usar meta única'}
      </button>
    </div>
  )
}

function StepFinancialDetailed({ e }: { e: ProjectEditor }) {
  return (
    <BudgetCategoriesEditor
      currency={e.currency}
      mode={e.budgetMode}
      onModeChange={e.setBudgetMode}
      categories={e.budgetCategories}
      onChange={e.setBudgetCategories}
    />
  )
}

function StepPrayer({ e }: { e: ProjectEditor }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Pontos que parceiros podem orar especificamente, em vez de só “orar pelo projeto”.</p>
      <PrayerPointsEditor points={e.prayerPoints} onChange={e.setPrayerPoints} originalLocale={e.originalLocale} profileId={e.profileId} />
    </div>
  )
}

function StepScripture({ e }: { e: ProjectEditor }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="scripture">Versículo / palavra</Label>
      <LocaleContentTabs
        originalLocale={e.originalLocale}
        originalText={e.scripture}
        onOriginalChange={e.setScripture}
        translations={e.scriptureTranslations}
        onTranslationChange={(locale, value) => { e.setScriptureTranslations((prev) => ({ ...prev, [locale]: value })); e.setScriptureSources((prev) => ({ ...prev, [locale]: 'human' })) }}
        onTranslateWithAi={(locale) => e.translateField(e.scripture, locale, e.setScriptureTranslations, e.setScriptureSources)}
        originalPlaceholder="Ex: Jeremias 29:11 — Porque eu sei os planos que tenho para vós..."
        rows={3}
      />
    </div>
  )
}

function StepLetter({ e }: { e: ProjectEditor }) {
  const t = useTranslations('PublicProject')
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="letter">A história por trás deste projeto</Label>
        <p className="text-xs text-muted-foreground">Conte o que Deus falou, por que isso importa e como surgiu. Tanto novos visitantes quanto parceiros antigos vão ler isso.</p>
        <LocaleContentTabs
          originalLocale={e.originalLocale}
          originalText={e.letter}
          onOriginalChange={e.setLetter}
          translations={e.letterTranslations}
          onTranslationChange={(locale, value) => { e.setLetterTranslations((prev) => ({ ...prev, [locale]: value })); e.setLetterSources((prev) => ({ ...prev, [locale]: 'human' })) }}
          onTranslateWithAi={(locale) => e.translateField(e.letter, locale, e.setLetterTranslations, e.setLetterSources)}
          originalPlaceholder="Queridos amigos e parceiros..."
          rows={8}
          textareaClassName="max-h-64 overflow-y-auto"
        />
      </div>
      <StoryImageField
        label={t('letterImageLabel')}
        draft={e.letterImage1}
        onChange={e.setLetterImage1}
        captionValue={e.letterImageCaption1}
        onCaptionChange={e.setLetterImageCaption1}
        captionPlaceholder={t('letterImageCaptionPlaceholder')}
      />
      <StoryImageField
        label={t('letterImageLabel2')}
        draft={e.letterImage2}
        onChange={e.setLetterImage2}
        captionValue={e.letterImageCaption2}
        onCaptionChange={e.setLetterImageCaption2}
        captionPlaceholder={t('letterImageCaptionPlaceholder')}
      />
    </>
  )
}

function StepMilestones({ e }: { e: ProjectEditor }) {
  return (
    <div className="space-y-3">
      <Label>Marcos do projeto</Label>
      <MilestonesEditor milestones={e.milestones} onChange={e.setMilestones} originalLocale={e.originalLocale} profileId={e.profileId} />
    </div>
  )
}

const STEP_COMPONENTS: Record<ProjectEditorStepId, (props: { e: ProjectEditor }) => React.ReactElement> = {
  cover: StepCover,
  identity: StepIdentity,
  'support-types': StepSupportTypes,
  schedule: StepSchedule,
  category: StepCategory,
  financial: StepFinancial,
  'financial-detailed': StepFinancialDetailed,
  prayer: StepPrayer,
  scripture: StepScripture,
  letter: StepLetter,
  milestones: StepMilestones,
}

function ReviewContent({ e }: { e: ProjectEditor }) {
  // Mesmo agrupamento de cards numerados de 2026-09-08 — só que agora
  // reaproveita as mesmas funções StepX usadas no passo a passo, em vez de
  // duplicar o JSX de cada campo.
  let n = 0
  const identityN = ++n
  const scheduleN = ++n
  const causeN = ++n
  const prayerN = e.prayerSectionShown ? ++n : null
  const storyN = ++n
  const milestonesN = ++n

  return (
    <div className="space-y-4">
      {e.mode === 'edit' && (
        <div className="flex justify-end gap-2">
          {([
            { value: 'active', label: '🟢 Ativo' },
            { value: 'completed', label: '✅ Concluído' },
            { value: 'hidden', label: '🔒 Oculto' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => e.setStatus(value)}
              className={`py-1.5 px-2.5 rounded-lg border text-xs transition-colors ${
                e.status === value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <SectionCard number={identityN} title="Identidade & Capa">
        <StepCover e={e} />
        <StepIdentity e={e} />
      </SectionCard>

      <SectionCard number={scheduleN} title="Cronograma & Formas de Apoio">
        <StepSchedule e={e} />
        <StepSupportTypes e={e} />
      </SectionCard>

      <SectionCard number={causeN} title="Causa & Metas">
        <StepCategory e={e} />
        {e.financialEnabled && <StepFinancial e={e} />}
        {e.detailedBudget && <StepFinancialDetailed e={e} />}
      </SectionCard>

      {prayerN !== null && (
        <SectionCard number={prayerN} title="Oração">
          <StepPrayer e={e} />
        </SectionCard>
      )}

      <SectionCard number={storyN} title="História & Fé">
        <StepScripture e={e} />
        <StepLetter e={e} />
      </SectionCard>

      <SectionCard number={milestonesN} title="Marcos">
        <StepMilestones e={e} />
      </SectionCard>
    </div>
  )
}

export function ProjectEditorModal({ mode, highlight, profileId, backPath, initialStepId }: Props) {
  const tDelete = useTranslations('DeleteProjectDialog')
  const e = useProjectEditor({ mode, highlight, profileId, backPath, initialStepId })

  const title = e.isReview ? 'Revisão' : STEP_LABELS[e.currentStepId as ProjectEditorStepId]
  const savingLabel = mode === 'edit' ? 'Salvando...' : 'Criando...'
  // O botão fica no cabeçalho fixo, mas a Revisão é longa — sem esse
  // spinner AQUI (onde o usuário está de fato olhando ao clicar), o único
  // sinal de "salvando" era um texto no fim do formulário, fora de vista,
  // dando a impressão de tela travada por vários segundos (reportado pelo
  // usuário: "não teve nenhum retorno visual"). `rightDisabled` já
  // desabilita o clique duplo, isso aqui é só o feedback visível.
  const rightLabel = e.saving
    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{savingLabel}</>
    : e.isReview
      ? (mode === 'edit' ? 'Salvar alterações' : 'Criar projeto')
      : (e.currentIndex === e.steps.length - 1 ? 'Ir pra revisão' : 'Próxima')

  // Fechar deve manter o usuário onde ele já estava (Feed, sidebar "Novo
  // projeto", banner de checklist etc.) em vez de sempre pular pra lista
  // pública de projetos — `backPath` continua sendo usado depois de
  // criar/salvar/excluir (onde ir pra lista de projetos É o destino certo),
  // só não é mais o destino do botão de fechar sem salvar nada.
  function handleClose() {
    if (hasInAppNavigation()) e.router.back()
    else e.router.push(backPath)
  }

  return (
    <>
      <WizardModal
        open
        onOpenChange={() => {}}
        onRequestClose={handleClose}
        title={title}
        closeLabel="Fechar"
        backLabel="Voltar"
        onBack={e.canGoBack ? e.goBack : undefined}
        rightLabel={rightLabel}
        onRight={e.isReview ? e.handleSubmit : e.goNext}
        rightDisabled={e.saving}
        footer={mode === 'edit' ? (
          <div className="px-4 py-3 border-t">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => e.setDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {tDelete('confirmDelete')}
            </Button>
          </div>
        ) : undefined}
      >
        {mode === 'create' && !e.isReview && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Passo {e.currentIndex + 1} de {e.steps.length}</span>
              <span className="font-semibold text-primary">{Math.round(((e.currentIndex + 1) / e.steps.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${((e.currentIndex + 1) / e.steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {e.isReview ? (
          <ReviewContent e={e} />
        ) : (
          <div className="space-y-5">
            {(() => {
              const StepComp = STEP_COMPONENTS[e.currentStepId as ProjectEditorStepId]
              return <StepComp e={e} />
            })()}
          </div>
        )}

        {e.saving && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
          </div>
        )}
      </WizardModal>

      {mode === 'edit' && highlight && (
        <DeleteProjectDialog
          open={e.deleteDialogOpen}
          onOpenChange={e.setDeleteDialogOpen}
          projectId={highlight.id}
          projectTitle={highlight.title}
          onDeleted={() => { e.router.push(backPath); e.router.refresh() }}
        />
      )}
    </>
  )
}
