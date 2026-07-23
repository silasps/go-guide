'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { CoverEditor, parsePosition, uniqueFileName } from './cover-editor'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

export function CoverTitleEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(snapshot.title)
  const [scripture, setScripture] = useState(snapshot.scripture)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState(snapshot.coverUrl ?? '')
  const [position, setPosition] = useState(parsePosition(snapshot.coverPosition || '50% 50%'))

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionCover') })}
          onClick={() => {
            setTitle(snapshot.title)
            setScripture(snapshot.scripture)
            setCoverFile(null)
            setCoverPreview(snapshot.coverUrl ?? '')
            setPosition(parsePosition(snapshot.coverPosition || '50% 50%'))
            setEditing(true)
          }}
        />
      </div>
    )
  }

  async function handleSave() {
    if (!title.trim()) return
    let coverUrl = snapshot.coverUrl
    if (coverFile) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${user!.id}/highlights/${uniqueFileName('webp')}`
      const { error } = await supabase.storage.from('media').upload(path, coverFile, { upsert: true })
      if (error) return
      coverUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    }
    const ok = await save({
      ...snapshot,
      highlightId,
      profileId,
      title: title.trim(),
      scripture: scripture.trim(),
      coverUrl,
      coverPosition: `${Math.round(position.x)}% ${Math.round(position.y)}%`,
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <div className="space-y-1.5">
        <Label>Capa</Label>
        <CoverEditor
          initialUrl={coverPreview}
          initialPosition={position}
          onChange={(file, previewUrl, pos) => {
            if (file) setCoverFile(file)
            setCoverPreview(previewUrl)
            setPosition(pos)
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scripture">Versículo / palavra</Label>
        <Textarea id="scripture" value={scripture} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScripture(e.target.value)} rows={3} />
      </div>
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
