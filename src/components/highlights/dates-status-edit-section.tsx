'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

const STATUS_OPTIONS = [
  { value: 'active', label: '🟢 Ativo' },
  { value: 'completed', label: '✅ Concluído' },
  { value: 'hidden', label: '🔒 Oculto' },
] as const

export function DatesStatusEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [tripStartDate, setTripStartDate] = useState(snapshot.tripStartDate ?? '')
  const [fundingDeadline, setFundingDeadline] = useState(snapshot.fundingDeadline ?? '')
  const [status, setStatus] = useState(snapshot.status)

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionDatesStatus') })}
          onClick={() => {
            setTripStartDate(snapshot.tripStartDate ?? '')
            setFundingDeadline(snapshot.fundingDeadline ?? '')
            setStatus(snapshot.status)
            setEditing(true)
          }}
        />
      </div>
    )
  }

  async function handleSave() {
    const ok = await save({
      ...snapshot,
      highlightId,
      profileId,
      tripStartDate: tripStartDate || null,
      fundingDeadline: fundingDeadline || null,
      status,
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="trip_start_date">Data da viagem</Label>
          <Input id="trip_start_date" type="date" value={tripStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTripStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="funding_deadline">Prazo para bater a meta</Label>
          <Input id="funding_deadline" type="date" value={fundingDeadline} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFundingDeadline(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map(({ value, label }) => (
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
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
