'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { MilestonesEditor, type MilestoneDraft } from './milestones-editor'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import { initialTranslations, initialSources, buildTranslationsPayload } from '@/lib/i18n/content-translations'
import type { SectionProps } from './section-types'

function toDrafts(milestones: SectionProps['snapshot']['milestones']): MilestoneDraft[] {
  return milestones.map((m) => ({
    id: m.id,
    title: m.title,
    is_completed: m.is_completed,
    translations: initialTranslations(m.titleTranslations),
    sources: initialSources(m.titleTranslations),
  }))
}

export function MilestonesEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<MilestoneDraft[]>(() => toDrafts(snapshot.milestones))

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionMilestones') })}
          onClick={() => { setValue(toDrafts(snapshot.milestones)); setEditing(true) }}
        />
      </div>
    )
  }

  async function handleSave() {
    const milestones = value.map((m) => ({
      id: m.id,
      title: m.title,
      is_completed: m.is_completed,
      titleTranslations: buildTranslationsPayload(snapshot.originalLocale, m.translations, m.sources),
    }))
    const ok = await save({ ...snapshot, highlightId, profileId, milestones })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <MilestonesEditor milestones={value} onChange={setValue} originalLocale={snapshot.originalLocale} profileId={profileId} />
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
