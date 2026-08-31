'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import type { HistoryBlock } from '@/types/history'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TimelineItem {
  id: string
  year: string
  text: string
}

interface Props {
  profileId: string
  blocks: HistoryBlock[]
  backPath: string
}

// Só os 4 tipos com um heading/formato conhecido pelo HistoryView — o 5º
// tipo ('text', um parágrafo solto sem título) é um fallback legado sem
// editor dedicado, não faz parte do fluxo normal de edição.
type EditableType = 'who_we_are' | 'our_calling' | 'timeline' | 'cta'

export function HistoryEditorForm({ profileId, blocks, backPath }: Props) {
  const t = useTranslations('HistoryEditor')
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()

  function findBlock(type: EditableType) {
    return blocks.find((b) => b.type === type)
  }

  const [whoTitle, setWhoTitle] = useState((findBlock('who_we_are')?.content.title as string) ?? '')
  const [whoText, setWhoText] = useState((findBlock('who_we_are')?.content.text as string) ?? '')
  const [callingTitle, setCallingTitle] = useState((findBlock('our_calling')?.content.title as string) ?? '')
  const [callingText, setCallingText] = useState((findBlock('our_calling')?.content.text as string) ?? '')
  const [timelineTitle, setTimelineTitle] = useState((findBlock('timeline')?.content.title as string) ?? '')
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>(
    ((findBlock('timeline')?.content.items as { year: string; text: string }[]) ?? []).map((item) => ({ id: crypto.randomUUID(), ...item }))
  )
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const [ctaTitle, setCtaTitle] = useState((findBlock('cta')?.content.title as string) ?? '')
  const [ctaText, setCtaText] = useState((findBlock('cta')?.content.text as string) ?? '')

  const [newYear, setNewYear] = useState('')
  const [newEventText, setNewEventText] = useState('')
  const newYearRef = useRef<HTMLInputElement>(null)

  function addTimelineItem() {
    if (!newYear.trim() || !newEventText.trim()) return
    setTimelineItems([...timelineItems, { id: crypto.randomUUID(), year: newYear.trim(), text: newEventText.trim() }])
    setNewYear('')
    setNewEventText('')
    newYearRef.current?.focus()
  }

  function removeTimelineItem(id: string) {
    setTimelineItems(timelineItems.filter((item) => item.id !== id))
  }

  function handleTimelineDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTimelineItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  function handleSave() {
    run(true, async () => {
      const supabase = createClient()

      // Seção sem conteúdo = bloco removido (não aparece mais na tela
      // pública), em vez de mostrar um cabeçalho vazio.
      const sections: { type: EditableType; content: Record<string, unknown> | null }[] = [
        { type: 'who_we_are', content: whoText.trim() ? { title: whoTitle.trim() || undefined, text: whoText.trim() } : null },
        { type: 'our_calling', content: callingText.trim() ? { title: callingTitle.trim() || undefined, text: callingText.trim() } : null },
        { type: 'timeline', content: timelineItems.length ? { title: timelineTitle.trim() || undefined, items: timelineItems.map(({ year, text }) => ({ year, text })) } : null },
        { type: 'cta', content: ctaText.trim() ? { title: ctaTitle.trim() || undefined, text: ctaText.trim() } : null },
      ]

      for (const [index, section] of sections.entries()) {
        const existing = findBlock(section.type)
        if (!section.content) {
          if (existing) await supabase.from('history_blocks').delete().eq('id', existing.id)
          continue
        }
        if (existing) {
          await supabase.from('history_blocks').update({ content: section.content, order_index: index }).eq('id', existing.id)
        } else {
          await supabase.from('history_blocks').insert({ profile_id: profileId, type: section.type, content: section.content, order_index: index })
        }
      }

      toast.success(t('saved'))
      router.push(backPath)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8 max-w-lg">
      <p className="text-sm text-muted-foreground">{t('pageIntro')}</p>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-sm">{t('whoWeAre')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('whoWeAreHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="who-title">{t('sectionTitle')}</Label>
          <Input id="who-title" value={whoTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWhoTitle(e.target.value)} placeholder={t('whoWeAre')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="who-text">{t('sectionText')}</Label>
          <Textarea id="who-text" value={whoText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWhoText(e.target.value)} rows={4} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-sm">{t('ourCalling')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ourCallingHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calling-title">{t('sectionTitle')}</Label>
          <Input id="calling-title" value={callingTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCallingTitle(e.target.value)} placeholder={t('ourCalling')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calling-text">{t('sectionText')}</Label>
          <Textarea id="calling-text" value={callingText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCallingText(e.target.value)} rows={4} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-sm">{t('timeline')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('timelineHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeline-title">{t('sectionTitle')}</Label>
          <Input id="timeline-title" value={timelineTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimelineTitle(e.target.value)} placeholder={t('timeline')} />
        </div>

        {timelineItems.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTimelineDragEnd}>
            <SortableContext items={timelineItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {timelineItems.map((item) => (
                  <SortableTimelineItem key={item.id} item={item} onRemove={removeTimelineItem} removeLabel={t('removeItem')} dragLabel={t('dragToReorder')} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="grid grid-cols-[80px_1fr_auto] gap-2">
          <Input
            ref={newYearRef}
            value={newYear}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewYear(e.target.value)}
            placeholder={t('timelineYearPlaceholder')}
          />
          <Input
            value={newEventText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEventText(e.target.value)}
            placeholder={t('timelineEventPlaceholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTimelineItem() } }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addTimelineItem} aria-label={t('addItem')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-sm">{t('cta')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ctaHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cta-title">{t('sectionTitle')}</Label>
          <Input id="cta-title" value={ctaTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCtaTitle(e.target.value)} placeholder={t('ctaTitlePlaceholder')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cta-text">{t('sectionText')}</Label>
          <Textarea id="cta-text" value={ctaText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCtaText(e.target.value)} placeholder={t('ctaTextPlaceholder')} rows={3} />
        </div>
      </section>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('save')}
      </Button>
    </div>
  )
}

function SortableTimelineItem({ item, onRemove, removeLabel, dragLabel }: {
  item: TimelineItem
  onRemove: (id: string) => void
  removeLabel: string
  dragLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2 text-sm border rounded-lg p-2 bg-background">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label={dragLabel}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="font-semibold text-primary shrink-0">{item.year}</span>
      <span className="flex-1 text-muted-foreground">{item.text}</span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={removeLabel}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}
