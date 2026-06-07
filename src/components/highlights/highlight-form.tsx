'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { Highlight, Milestone } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ImagePlus, Plus, Trash2, CheckCircle2, Circle, Move } from 'lucide-react'
import Image from 'next/image'

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']

const SUPPORT_TYPES = [
  { value: 'financial',   emoji: '💰', label: 'Apoio financeiro',    desc: 'Doação mensal ou pontual' },
  { value: 'prayer',      emoji: '🙏', label: 'Oração',              desc: 'Compromisso de orar regularmente' },
  { value: 'ambassador',  emoji: '📣', label: 'Divulgação',           desc: 'Compartilhar o projeto e trazer novos apoiadores' },
  { value: 'volunteer',   emoji: '🤝', label: 'Voluntário',          desc: 'Apoio pessoal ou com habilidades' },
  { value: 'ongoing',     emoji: '🔄', label: 'Ministério contínuo', desc: 'Sem meta específica, apoio de longo prazo' },
] as const

function parsePosition(pos: string): { x: number; y: number } {
  const [x, y] = pos.replace(/%/g, '').split(' ').map(Number)
  return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y }
}

interface Props {
  highlight?: Highlight & { milestones?: Milestone[] }
  profileId: string
  backPath?: string
}

export function HighlightForm({ highlight, profileId, backPath = '/dashboard/projetos' }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(highlight?.title ?? '')
  const [description, setDescription] = useState(highlight?.description ?? '')
  const [goalTypes, setGoalTypes] = useState<string[]>(
    Array.isArray(highlight?.goal_type) ? highlight.goal_type : ['financial']
  )
  function toMasked(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return Number(digits).toLocaleString('pt-BR')
  }
  function fromMasked(masked: string) {
    return masked.replace(/\./g, '').replace(',', '.')
  }

  const [goalAmount, setGoalAmount] = useState(
    highlight?.goal_amount ? toMasked(String(Math.round(highlight.goal_amount))) : ''
  )
  const [currentAmount, setCurrentAmount] = useState(
    highlight?.current_amount ? toMasked(String(Math.round(highlight.current_amount))) : '0'
  )
  const [currency, setCurrency] = useState(highlight?.currency ?? 'BRL')
  const [coverPreview, setCoverPreview] = useState<string>(highlight?.cover_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number }>(
    parsePosition(highlight?.cover_position ?? '50% 50%')
  )
  const [scripture, setScripture] = useState(highlight?.scripture ?? '')
  const [letter, setLetter] = useState(highlight?.letter ?? '')
  const [status, setStatus] = useState<'active' | 'hidden' | 'completed'>(
    (highlight?.status as 'active' | 'hidden' | 'completed') ?? 'active'
  )
  const [milestones, setMilestones] = useState<Array<{ id?: string; title: string; is_completed: boolean }>>(
    highlight?.milestones ?? []
  )
  const [newMilestone, setNewMilestone] = useState('')

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

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Título obrigatório.'); return }
    setSaving(true)

    try {
      const supabase = createClient()
      let cover_url = highlight?.cover_url ?? null

      if (coverFile) {
        const path = `${profileId}/highlights/${Date.now()}.webp`
        const { error } = await supabase.storage.from('media').upload(path, coverFile, { upsert: true })
        if (error) throw error
        cover_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
      }

      const cover_position = `${Math.round(position.x)}% ${Math.round(position.y)}%`
      const types = goalTypes.length > 0 ? goalTypes : ['ongoing']
      const hasFinancial = types.includes('financial')

      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          highlightId: highlight?.id,
          profileId,
          title: title.trim(),
          description: description.trim(),
          goalTypes,
          goalAmount: hasFinancial && goalAmount ? parseFloat(fromMasked(goalAmount)) : null,
          currentAmount: hasFinancial ? (parseFloat(fromMasked(currentAmount)) || 0) : 0,
          currency,
          coverUrl: cover_url,
          coverPosition: cover_position,
          scripture: scripture.trim(),
          letter: letter.trim(),
          status,
          milestones,
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
    } finally {
      setSaving(false)
    }
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-1">
                <Label htmlFor="currency">Moeda</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal">Meta</Label>
                <Input
                  id="goal"
                  inputMode="numeric"
                  value={goalAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoalAmount(toMasked(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current">Arrecadado</Label>
                <Input
                  id="current"
                  inputMode="numeric"
                  value={currentAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentAmount(toMasked(e.target.value))}
                  placeholder="0"
                />
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
