'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ImagePlus, X, Move, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { compressImage } from '@/lib/media/compress'
import { bakeImage } from '@/lib/media/bake-image'
import { createMediaDraft, type MediaDraft } from '@/components/shared/media-editor/types'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'

export interface ImageDraft { url: string; file?: File }

export function toImageDraft(url: string | null): ImageDraft {
  return { url: url ?? '' }
}

interface StoryImageFieldProps {
  label: string
  draft: ImageDraft
  onChange: (draft: ImageDraft) => void
  captionValue: string
  onCaptionChange: (value: string) => void
  captionPlaceholder: string
}

// Mesma proporção usada na página pública (`LetterImage` em letter-body.tsx).
const ASPECT = '4:3'

// Extraído de letter-edit-section.tsx (removido) — mesma lógica, agora
// reaproveitado pelo editor de projeto (etapa "Carta" e "Revisão"). Recorte
// ajustável (arrastar + zoom) reaproveitando o mesmo ImageCropEditor/
// bakeImage do composer de post e da capa de perfil — antes a miniatura só
// cortava automaticamente pelo centro (`object-cover`), sem controle nenhum
// (feedback direto do usuário, comparando com o fluxo de inserir imagem no
// post). "Reposicionar" (ícone Move) reabre o editor sobre a imagem já
// salva — mesmo padrão do "reposicionar capa" em profile-form.tsx.
export function StoryImageField({ label, draft, onChange, captionValue, onCaptionChange, captionPlaceholder }: StoryImageFieldProps) {
  const t = useTranslations('PublicProject')
  const [loading, setLoading] = useState(false)
  const [editingMedia, setEditingMedia] = useState<MediaDraft | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setEditingMedia(createMediaDraft(file, 'image'))
  }

  async function handleReposition() {
    if (!draft.url) return
    const res = await fetch(draft.url)
    const blob = await res.blob()
    const file = new File([blob], 'story-image.jpg', { type: blob.type || 'image/jpeg' })
    setEditingMedia(createMediaDraft(file, 'image'))
  }

  async function handleSave() {
    if (!editingMedia) return
    setLoading(true)
    const baked = await bakeImage({
      previewUrl: editingMedia.previewUrl,
      fileName: editingMedia.file.name,
      position: editingMedia.position,
      zoom: editingMedia.zoom,
      aspect: ASPECT,
    })
    const compressed = await compressImage(baked)
    URL.revokeObjectURL(editingMedia.previewUrl)
    onChange({ url: URL.createObjectURL(compressed), file: compressed })
    setLoading(false)
    setEditingMedia(null)
  }

  if (editingMedia) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-3">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <ImageCropEditor
          media={editingMedia}
          aspect={ASPECT}
          onAspectChange={() => {}}
          onPositionChange={(position) => setEditingMedia((prev) => (prev ? { ...prev, position } : prev))}
          onZoomChange={(zoom) => setEditingMedia((prev) => (prev ? { ...prev, zoom } : prev))}
          showAspectPicker={false}
        />
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
            {t('letterImageChange')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingMedia(null)} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
              {loading ? t('letterImageProcessing') : t('save')}
            </Button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} />
      </div>
    )
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {/* aspect-[4/3]: mesma proporção usada na página pública, agora
       *  batendo exatamente com o recorte que o usuário escolheu no editor
       *  (não mais um object-cover automático sem relação com o ajuste). */}
      {draft.url ? (
        <div className="relative aspect-[4/3] w-full max-w-64 mx-auto">
          <Image src={draft.url} alt="" fill className="object-cover rounded-lg" />
          <button
            type="button"
            onClick={handleReposition}
            className="absolute bottom-2 right-11 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
            aria-label={t('letterImageReposition')}
            title={t('letterImageReposition')}
          >
            <Move className="h-3.5 w-3.5" />
          </button>
          <label className="absolute bottom-2 right-2 cursor-pointer">
            <div
              className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
              aria-label={t('letterImageChange')}
              title={t('letterImageChange')}
            >
              <Camera className="h-3.5 w-3.5" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
          </label>
          <button
            type="button"
            onClick={() => onChange({ url: '' })}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex aspect-[4/3] w-full max-w-64 mx-auto flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <ImagePlus className="h-4 w-4" />
          <span className="text-xs">{t('letterImageUpload')}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
        </label>
      )}
      {draft.url && (
        <Input value={captionValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCaptionChange(e.target.value)} placeholder={captionPlaceholder} />
      )}
    </div>
  )
}
