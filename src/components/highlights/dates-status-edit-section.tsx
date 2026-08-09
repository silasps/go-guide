'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

// Só datas — status virou um badge próprio e clicável (status-badge.tsx),
// direto ao lado do título, porque ninguém abria esse formulário só pra
// trocar o status (feedback direto do usuário: "escondendo status").
export function DatesStatusEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [tripStartDate, setTripStartDate] = useState(snapshot.tripStartDate ?? '')
  const [fundingDeadline, setFundingDeadline] = useState(snapshot.fundingDeadline ?? '')

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
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="trip_start_date">Data de início</Label>
          <Input id="trip_start_date" type="date" value={tripStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTripStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="funding_deadline">Prazo para bater a meta</Label>
          <Input id="funding_deadline" type="date" value={fundingDeadline} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFundingDeadline(e.target.value)} />
        </div>
      </div>
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
