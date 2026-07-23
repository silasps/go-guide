'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { MilestonesEditor, type MilestoneDraft } from './milestones-editor'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

export function MilestonesEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<MilestoneDraft[]>(snapshot.milestones)

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionMilestones') })}
          onClick={() => { setValue(snapshot.milestones); setEditing(true) }}
        />
      </div>
    )
  }

  async function handleSave() {
    const ok = await save({ ...snapshot, highlightId, profileId, milestones: value })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <MilestonesEditor milestones={value} onChange={setValue} />
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
