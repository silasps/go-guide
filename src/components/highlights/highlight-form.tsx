'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { compressImage } from '@/lib/media/compress'
import { Highlight, Milestone, ProjectBudgetCategory, BudgetCategoryType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ImagePlus, Plus, Trash2, CheckCircle2, Circle, Move } from 'lucide-react'
import Image from 'next/image'

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']

const CURRENCY_SEPARATORS: Record<string, { decimal: string; thousands: string }> = {
  BRL: { decimal: ',', thousands: '.' },
  EUR: { decimal: ',', thousands: '.' },
  USD: { decimal: '.', thousands: ',' },
  GBP: { decimal: '.', thousands: ',' },
  CHF: { decimal: '.', thousands: ',' },
  CAD: { decimal: '.', thousands: ',' },
  AUD: { decimal: '.', thousands: ',' },
}

/** Formats raw digits as cents, like a bank app amount field (digits fill in from the right). */
function toMasked(raw: string, currency: string) {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  const { decimal, thousands } = CURRENCY_SEPARATORS[currency] ?? CURRENCY_SEPARATORS.BRL
  const cents = digits.padStart(3, '0')
  const intPart = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, thousands)
  const decPart = cents.slice(-2)
  return `${intPart}${decimal}${decPart}`
}

function fromMasked(masked: string, currency: string) {
  const { decimal, thousands } = CURRENCY_SEPARATORS[currency] ?? CURRENCY_SEPARATORS.BRL
  let result = masked.split(thousands).join('')
  if (decimal !== '.') result = result.split(decimal).join('.')
  return result
}

/** Re-renders an already-masked value when the currency (and thus its separators) changes. */
function reformatMasked(masked: string, oldCurrency: string, newCurrency: string) {
  if (!masked) return masked
  const plain = parseFloat(fromMasked(masked, oldCurrency))
  if (isNaN(plain)) return masked
  return toMasked(String(Math.round(plain * 100)), newCurrency)
}

const BUDGET_CATEGORY_LABELS: Record<BudgetCategoryType, string> = {
  airfare: 'Passagem aérea',
  bus: 'Ônibus',
  boat: 'Barco',
  ferry: 'Balsa',
  rideshare: 'Uber/táxi',
  lodging: 'Estadia',
  food: 'Alimentação',
  equipment: 'Equipamento',
  visa_documentation: 'Visto/documentação',
  insurance: 'Seguro viagem',
  training: 'Treinamento',
  shipping: 'Envio de carga',
  other: 'Outros',
}

const SUPPORT_TYPES = [
  { value: 'financial',   emoji: '💰', label: 'Apoio financeiro',    desc: 'Doação mensal ou pontual' },
  { value: 'prayer',      emoji: '🙏', label: 'Oração',              desc: 'Compromisso de orar regularmente' },
  { value: 'ambassador',  emoji: '📣', label: 'Divulgação',           desc: 'Compartilhar o projeto e trazer novos apoiadores' },
  { value: 'volunteer',   emoji: '🤝', label: 'Voluntário',          desc: 'Apoio pessoal ou com habilidades' },
  { value: 'ongoing',     emoji: '🔄', label: 'Ministério contínuo', desc: 'Sem meta específica, apoio de longo prazo' },
] as const

function uniqueFileName(ext: string) {
  return `${crypto.randomUUID()}.${ext}`
}

function parsePosition(pos: string): { x: number; y: number } {
  const [x, y] = pos.replace(/%/g, '').split(' ').map(Number)
  return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y }
}

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
  const initialCurrency = highlight?.currency ?? 'BRL'
  const [goalAmount, setGoalAmount] = useState(
    highlight?.goal_amount ? toMasked(String(Math.round(highlight.goal_amount * 100)), initialCurrency) : ''
  )
  const [currentAmount, setCurrentAmount] = useState(
    toMasked(String(Math.round((highlight?.current_amount ?? 0) * 100)), initialCurrency)
  )
  const [currency, setCurrency] = useState(initialCurrency)
  const [coverPreview, setCoverPreview] = useState<string>(highlight?.cover_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
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
  const [milestones, setMilestones] = useState<Array<{ id?: string; title: string; is_completed: boolean }>>(
    highlight?.milestones ?? []
  )
  const [newMilestone, setNewMilestone] = useState('')

  const [budgetMode, setBudgetMode] = useState<'single' | 'detailed'>(
    (highlight?.budgetCategories?.length ?? 0) > 0 ? 'detailed' : 'single'
  )
  const [budgetCategories, setBudgetCategories] = useState<Array<{ category_type: BudgetCategoryType; custom_label: string; target_amount: string }>>(
    (highlight?.budgetCategories ?? []).map(b => ({
      category_type: b.category_type,
      custom_label: b.custom_label ?? '',
      target_amount: toMasked(String(Math.round(b.target_amount * 100)), initialCurrency),
    }))
  )
  const [newBudgetCategoryType, setNewBudgetCategoryType] = useState<BudgetCategoryType>('airfare')

  function addBudgetCategory() {
    setBudgetCategories(prev => [...prev, { category_type: newBudgetCategoryType, custom_label: '', target_amount: '' }])
  }
  function removeBudgetCategory(idx: number) {
    setBudgetCategories(prev => prev.filter((_, i) => i !== idx))
  }
  function updateBudgetCategory(idx: number, patch: Partial<{ category_type: BudgetCategoryType; custom_label: string; target_amount: string }>) {
    setBudgetCategories(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))
  }
  const budgetTotal = budgetCategories.reduce((sum, b) => sum + (parseFloat(fromMasked(b.target_amount, currency)) || 0), 0)

  // Drag state (refs to avoid re-renders during drag)
  const dragging = useRef(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 })
  const previewRef = useRef<HTMLDivElement>(null)

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const dx = ((clientX - dragStart.current.mouseX) / rect.width) * 100
    const dy = ((clientY - dragStart.current.mouseY) / rect.height) * 100
    const x = Math.min(100, Math.max(0, dragStart.current.posX - dx))
    const y = Math.min(100, Math.max(0, dragStart.current.posY - dy))
    setPosition({ x, y })
  }, [])

  const onDragEnd = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY) }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onDragEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onDragEnd)
    }
  }, [onDragMove, onDragEnd])

  function startDrag(clientX: number, clientY: number) {
    dragging.current = true
    dragStart.current = { mouseX: clientX, mouseY: clientY, posX: position.x, posY: position.y }
  }

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setCoverFile(compressed)
    setCoverPreview(URL.createObjectURL(compressed))
    setPosition({ x: 50, y: 50 })
  }

  function addMilestone() {
    const t = newMilestone.trim()
    if (!t) return
    setMilestones(prev => [...prev, { title: t, is_completed: false }])
    setNewMilestone('')
  }

  function removeMilestone(idx: number) {
    setMilestones(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleMilestone(idx: number) {
    setMilestones(prev => prev.map((m, i) => i === idx ? { ...m, is_completed: !m.is_completed } : m))
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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

            <div
              ref={previewRef}
              className="relative h-48 rounded-xl bg-muted overflow-hidden border border-dashed select-none"
              style={{ cursor: coverPreview ? 'grab' : 'default' }}
              onMouseDown={coverPreview ? (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY) } : undefined}
              onTouchStart={coverPreview ? (e) => startDrag(e.touches[0].clientX, e.touches[0].clientY) : undefined}
            >
              {coverPreview ? (
                <>
                  <Image
                    src={coverPreview}
                    alt="capa"
                    fill
                    draggable={false}
                    className="object-cover pointer-events-none"
                    style={{ objectPosition: `${position.x}% ${position.y}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                      <Move className="h-3.5 w-3.5" />
                      Arraste para reposicionar
                    </div>
                  </div>
                  <label className="absolute bottom-2 right-2 cursor-pointer">
                    <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 transition-colors">
                      Trocar
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                  </label>
                </>
              ) : (
                <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-sm">Clique para adicionar capa</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                </label>
              )}
            </div>

            {coverPreview && (
              <div className="flex items-center gap-3 pt-1">
                <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-muted shrink-0">
                  <Image
                    src={coverPreview}
                    alt="thumb"
                    fill
                    draggable={false}
                    className="object-cover pointer-events-none"
                    style={{ objectPosition: `${position.x}% ${position.y}%` }}
                  />
                </div>
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
            <div className="space-y-2 pt-1">
              {SUPPORT_TYPES.map(({ value, emoji, label, desc }) => {
                const selected = goalTypes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGoalTypes(prev =>
                      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
                    )}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/8 text-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-lg shrink-0">{emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-xs opacity-70">{desc}</p>
                    </div>
                    <div className={`ml-auto h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      selected ? 'bg-primary border-primary' : 'border-input'
                    }`}>
                      {selected && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
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
                    onChange={(e) => {
                      const newCurrency = e.target.value
                      setGoalAmount(prev => reformatMasked(prev, currency, newCurrency))
                      setCurrentAmount(prev => reformatMasked(prev, currency, newCurrency))
                      setBudgetCategories(prev => prev.map(b => ({ ...b, target_amount: reformatMasked(b.target_amount, currency, newCurrency) })))
                      setCurrency(newCurrency)
                    }}
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Orçamento detalhado por categoria</Label>
                  <button
                    type="button"
                    onClick={() => setBudgetMode(m => m === 'single' ? 'detailed' : 'single')}
                    className="text-xs text-primary hover:underline"
                  >
                    {budgetMode === 'single' ? 'Detalhar por categoria' : 'Usar meta única'}
                  </button>
                </div>

                {budgetMode === 'detailed' && (
                  <div className="space-y-2 rounded-xl border p-3">
                    {budgetCategories.map((b, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <select
                          value={b.category_type}
                          onChange={(e) => updateBudgetCategory(i, { category_type: e.target.value as BudgetCategoryType })}
                          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring flex-1 min-w-0"
                        >
                          {Object.entries(BUDGET_CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        {b.category_type === 'other' && (
                          <Input
                            value={b.custom_label}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBudgetCategory(i, { custom_label: e.target.value })}
                            placeholder="Qual?"
                            className="h-8 text-xs flex-1"
                          />
                        )}
                        <Input
                          inputMode="numeric"
                          value={b.target_amount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBudgetCategory(i, { target_amount: toMasked(e.target.value, currency) })}
                          placeholder="Valor"
                          className="h-8 text-xs w-24 shrink-0"
                        />
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeBudgetCategory(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <select
                        value={newBudgetCategoryType}
                        onChange={(e) => setNewBudgetCategoryType(e.target.value as BudgetCategoryType)}
                        className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                      >
                        {Object.entries(BUDGET_CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={addBudgetCategory} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Meta total (soma das categorias): <span className="font-medium text-foreground">{budgetTotal.toLocaleString('pt-BR', { style: 'currency', currency })}</span>
                    </p>
                  </div>
                )}
              </div>
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
            {milestones.length > 0 && (
              <ul className="space-y-1.5">
                {milestones.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <button type="button" onClick={() => toggleMilestone(i)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                      {m.is_completed
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <Circle className="h-4 w-4" />
                      }
                    </button>
                    <span className={m.is_completed ? 'line-through text-muted-foreground' : ''}>{m.title}</span>
                    <button type="button" onClick={() => removeMilestone(i)} className="ml-auto shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={newMilestone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMilestone(e.target.value)}
                placeholder="Ex: Fundação concluída"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone() } }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addMilestone}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
