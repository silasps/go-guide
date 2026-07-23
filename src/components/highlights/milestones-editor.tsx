'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'

export interface MilestoneDraft { id?: string; title: string; is_completed: boolean }

interface Props {
  milestones: MilestoneDraft[]
  onChange: (milestones: MilestoneDraft[]) => void
}

export function MilestonesEditor({ milestones, onChange }: Props) {
  const [newMilestone, setNewMilestone] = useState('')

  function addMilestone() {
    const t = newMilestone.trim()
    if (!t) return
    onChange([...milestones, { title: t, is_completed: false }])
    setNewMilestone('')
  }

  function removeMilestone(idx: number) {
    onChange(milestones.filter((_, i) => i !== idx))
  }

  function toggleMilestone(idx: number) {
    onChange(milestones.map((m, i) => i === idx ? { ...m, is_completed: !m.is_completed } : m))
  }

  return (
    <div className="space-y-3">
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
  )
}
