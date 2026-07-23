'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Textarea } from '@/components/ui/textarea'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

export function LetterEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(snapshot.letter)

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionLetter') })}
          onClick={() => { setValue(snapshot.letter); setEditing(true) }}
        />
      </div>
    )
  }

  async function handleSave() {
    const ok = await save({ ...snapshot, highlightId, profileId, letter: value })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <Textarea value={value} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)} rows={8} />
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
