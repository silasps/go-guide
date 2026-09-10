'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

export interface PrayerPointDraft { id?: string; title: string; description: string; is_completed: boolean }

interface Props {
  points: PrayerPointDraft[]
  onChange: (points: PrayerPointDraft[]) => void
}

/** Mesmo padrão 100% controlado de BudgetCategoriesEditor — sem valor/moeda
 *  (isso é só do lado financeiro), só título + descrição do que orar.
 *
 *  Título e descrição aparecem juntos desde a primeira letra digitada —
 *  antes, "Adicionar" só criava o título e a descrição só surgia depois,
 *  o que dava a impressão de que o ponto de oração já tinha sido criado
 *  (a pedido do usuário, ver Changelog). */
export function PrayerPointsEditor({ points, onChange }: Props) {
  function addPoint() {
    onChange([...points, { title: '', description: '', is_completed: false }])
  }
  function removePoint(idx: number) {
    onChange(points.filter((_, i) => i !== idx))
  }
  function updatePoint(idx: number, patch: Partial<PrayerPointDraft>) {
    onChange(points.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      {points.map((p, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border/60 p-2.5">
          <div className="flex gap-2 items-start">
            <Input
              autoFocus={!p.title && !p.description && i === points.length - 1}
              value={p.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePoint(i, { title: e.target.value })}
              placeholder="Ex: Proteção da equipe em campo"
              className="h-8 text-xs flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 pt-1.5">
              <input
                type="checkbox"
                checked={p.is_completed}
                onChange={(e) => updatePoint(i, { is_completed: e.target.checked })}
                className="rounded border-input"
              />
              Concluído
            </label>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePoint(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">O que orar sobre isso</Label>
            <Textarea
              value={p.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePoint(i, { description: e.target.value })}
              placeholder="Ex: Saúde da equipe, segurança nas viagens, disposição pra continuar"
              className="min-h-8 text-xs py-1.5"
              rows={2}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addPoint} className="gap-1.5 w-full justify-center">
        <Plus className="h-3.5 w-3.5" /> Adicionar ponto de oração
      </Button>
      {points.length === 0 && (
        <Label className="text-xs font-normal text-muted-foreground">Nenhum ponto de oração ainda — opcional, mas ajuda parceiros a orar de forma específica.</Label>
      )}
    </div>
  )
}
