'use client'

import { useState } from 'react'
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
 *  (isso é só do lado financeiro), só título + descrição do que orar. */
export function PrayerPointsEditor({ points, onChange }: Props) {
  const [newTitle, setNewTitle] = useState('')

  function addPoint() {
    if (!newTitle.trim()) return
    onChange([...points, { title: newTitle.trim(), description: '', is_completed: false }])
    setNewTitle('')
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
        <div key={i} className="space-y-1.5 rounded-lg border border-border/60 p-2">
          <div className="flex gap-2 items-start">
            <Input
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
          <Textarea
            value={p.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePoint(i, { description: e.target.value })}
            placeholder="Descrição (o que orar sobre isso)"
            className="min-h-8 text-xs py-1.5"
            rows={2}
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Input
          value={newTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
          placeholder="Novo ponto de oração"
          className="h-8 text-xs flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addPoint} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
      {points.length === 0 && (
        <Label className="text-xs font-normal text-muted-foreground">Nenhum ponto de oração ainda — opcional, mas ajuda parceiros a orar de forma específica.</Label>
      )}
    </div>
  )
}
