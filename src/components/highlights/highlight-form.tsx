'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Highlight, Milestone, ProjectBudgetCategory } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { toMasked, fromMasked, reformatMasked, CURRENCIES } from '@/lib/currency-mask'
import { CoverEditor, parsePosition, uniqueFileName } from './cover-editor'
import { MilestonesEditor, type MilestoneDraft } from './milestones-editor'
import { BudgetCategoriesEditor, type BudgetCategoryDraft } from './budget-categories-editor'
import { SupportTypesPicker } from './support-types-picker'

// Assunto do projeto (ortogonal ao goal_type acima, que é o TIPO DE APOIO
// pedido) — sinal de afinidade usado pelo ranking do feed, sem UI pública.
const PROJECT_CATEGORIES = [
  { value: 'children',                emoji: '🧒', label: 'Crianças' },
  { value: 'health',                  emoji: '🩺', label: 'Saúde' },
  { value: 'education',               emoji: '📚', label: 'Educação' },
  { value: 'evangelism',              emoji: '✝️', label: 'Evangelismo' },
  { value: 'community_development',   emoji: '🏘️', label: 'Desenvolvimento comunitário' },
  { value: 'disaster_relief',         emoji: '🆘', label: 'Desastres/emergência' },
  { value: 'other',                   emoji: '✨', label: 'Outro' },
] as const

interface Props {
  highlight?: Highlight & { milestones?: Milestone[]; budgetCategories?: ProjectBudgetCategory[] }
  profileId: string
  backPath?: string
}

export function HighlightForm({ highlight, profileId, backPath = '/dashboard/projetos' }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [title, setTitle] = useState(highlight?.title ?? '')
  const [description, setDescription] = useState(highlight?.description ?? '')
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
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string>(highlight?.cover_url ?? '')
  const [position, setPosition] = useState<{ x: number; y: number }>(
    parsePosition(highlight?.cover_position ?? '50% 50%')
  )
  const [tripStartDate, setTripStartDate] = useState(highlight?.trip_start_date ?? '')
  const [fundingDeadline, setFundingDeadline] = useState(highlight?.funding_deadline ?? '')
  const [scripture, setScripture] = useState(highlight?.scripture ?? '')
  const [letter, setLetter] = useState(highlight?.letter ?? '')
  const [status, setStatus] = useState<'active' | 'hidden' | 'completed'>(
    (highlight?.status as 'active' | 'hidden' | 'completed') ?? 'active'
  )
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(highlight?.milestones ?? [])

  const [budgetMode, setBudgetMode] = useState<'single' | 'detailed'>(
    (highlight?.budgetCategories?.length ?? 0) > 0 ? 'detailed' : 'single'
  )
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryDraft[]>(
    (highlight?.budgetCategories ?? []).map(b => ({
      category_type: b.category_type,
      custom_label: b.custom_label ?? '',
      target_amount: toMasked(String(Math.round(b.target_amount * 100)), initialCurrency),
    }))
  )
  const budgetTotal = budgetCategories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  function handleCurrencyChange(newCurrency: string) {
    setGoalAmount(prev => reformatMasked(prev, currency, newCurrency))
    setCurrentAmount(prev => reformatMasked(prev, currency, newCurrency))
    setBudgetCategories(prev => prev.map(b => ({ ...b, target_amount: reformatMasked(b.target_amount, currency, newCurrency) })))
    setCurrency(newCurrency)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Título obrigatório.'); return }

    run(true, async () => {
      try {
        const supabase = createClient()
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        let cover_url = highlight?.cover_url ?? null

        if (coverFile) {
          const path = `${currentUser!.id}/highlights/${uniqueFileName('webp')}`
          const { error } = await supabase.storage.from('media').upload(path, coverFile, { upsert: true })
          if (error) throw error
          cover_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
        }

        const cover_position = `${Math.round(position.x)}% ${Math.round(position.y)}%`
        const types = goalTypes.length > 0 ? goalTypes : ['ongoing']
        const hasFinancial = types.includes('financial')
        const isDetailedBudget = hasFinancial && budgetMode === 'detailed'

        const res = await fetch('/api/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            highlightId: highlight?.id,
            profileId,
            title: title.trim(),
            description: description.trim(),
            goalTypes,
            category: categories,
            goalAmount: isDetailedBudget ? budgetTotal : (hasFinancial && goalAmount ? parseFloat(fromMasked(goalAmount, currency)) : null),
            currentAmount: hasFinancial ? (parseFloat(fromMasked(currentAmount, currency)) || 0) : 0,
            currency,
            coverUrl: cover_url,
            coverPosition: cover_position,
            tripStartDate: tripStartDate || null,
            fundingDeadline: fundingDeadline || null,
            scripture: scripture.trim(),
            letter: letter.trim(),
            status,
            milestones,
            budgetCategories: isDetailedBudget
              ? budgetCategories
                  .filter(b => parseFloat(fromMasked(b.target_amount, currency)) > 0)
                  .map(b => ({
                    category_type: b.category_type,
                    custom_label: b.category_type === 'other' ? (b.custom_label.trim() || 'Outros') : null,
                    target_amount: parseFloat(fromMasked(b.target_amount, currency)),
                  }))
              : [],
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
            <CoverEditor
              initialUrl={coverPreview}
              initialPosition={position}
              onChange={(file, previewUrl, pos) => {
                if (file) setCoverFile(file)
                setCoverPreview(previewUrl)
                setPosition(pos)
              }}
            />
            {coverPreview && (
              <div className="flex items-center gap-3 pt-1">
                <p className="text-xs text-muted-foreground">Prévia do card (como aparece na lista de projetos)</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Ex: Construção da Base em Moçambique" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} placeholder="Descreva o projeto e seu impacto..." rows={3} />
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
            <Textarea
              id="scripture"
              value={scripture}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScripture(e.target.value)}
              placeholder="Ex: Jeremias 29:11 — Porque eu sei os planos que tenho para vós..."
              rows={3}
            />
          </div>

          {/* Carta */}
          <div className="space-y-2">
            <Label htmlFor="letter">A história por trás deste projeto</Label>
            <p className="text-xs text-muted-foreground">Conte o que Deus falou, por que isso importa e como surgiu. Tanto novos visitantes quanto parceiros antigos vão ler isso.</p>
            <Textarea
              id="letter"
              value={letter}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLetter(e.target.value)}
              placeholder="Queridos amigos e parceiros..."
              rows={8}
            />
          </div>

          {/* Marcos */}
          <div className="space-y-3">
            <Label>Marcos do projeto</Label>
            <MilestonesEditor milestones={milestones} onChange={setMilestones} />
          </div>
        </div>
      </div>

      {/* Botões — fora do grid, abaixo das duas colunas */}
      <div className="flex gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={() => router.push(backPath)}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {highlight ? 'Salvar alterações' : 'Criar projeto'}
        </Button>
      </div>
    </form>
  )
}
