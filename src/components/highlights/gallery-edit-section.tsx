'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { GalleryEditor, type GalleryImageDraft } from './gallery-editor'
import { uniqueFileName } from './cover-editor'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import type { SectionProps } from './section-types'

function toDrafts(urls: string[]): GalleryImageDraft[] {
  return urls.map(url => ({ url }))
}

export function GalleryEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [images, setImages] = useState<GalleryImageDraft[]>(toDrafts(snapshot.galleryImages))

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionGallery') })}
          onClick={() => { setImages(toDrafts(snapshot.galleryImages)); setEditing(true) }}
        />
      </div>
    )
  }

  async function handleSave() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const urls: string[] = []
    for (const img of images) {
      if (!img.file) { urls.push(img.url); continue }
      const path = `${user!.id}/highlights/${uniqueFileName('webp')}`
      const { error } = await supabase.storage.from('media').upload(path, img.file, { upsert: true })
      if (error) return
      urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
    }
    const ok = await save({ ...snapshot, highlightId, profileId, galleryImages: urls })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <GalleryEditor images={images} onChange={setImages} />
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
