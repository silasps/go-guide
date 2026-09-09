'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImagePlus, X } from 'lucide-react'
import { compressImage } from '@/lib/media/compress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  uploadLabel: string
  changeLabel: string
  processingLabel: string
}

// Extraído de letter-edit-section.tsx (removido) — mesma lógica, agora
// reaproveitado pelo editor de projeto (etapa "Carta" e "Revisão").
export function StoryImageField({ label, draft, onChange, captionValue, onCaptionChange, captionPlaceholder, uploadLabel, changeLabel, processingLabel }: StoryImageFieldProps) {
  const [loading, setLoading] = useState(false)

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const compressed = await compressImage(file)
    onChange({ url: URL.createObjectURL(compressed), file: compressed })
    setLoading(false)
    e.target.value = ''
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {draft.url ? (
        <div className="relative h-32 w-full">
          <Image src={draft.url} alt="" fill className="object-cover rounded-lg" />
          <label className="absolute bottom-2 right-2 cursor-pointer">
            <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 transition-colors">
              {loading ? processingLabel : changeLabel}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleSelect} disabled={loading} />
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
        <label className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-lg border border-dashed cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <ImagePlus className="h-4 w-4" />
          <span className="text-xs">{loading ? processingLabel : uploadLabel}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleSelect} disabled={loading} />
        </label>
      )}
      {draft.url && (
        <Input value={captionValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCaptionChange(e.target.value)} placeholder={captionPlaceholder} />
      )}
    </div>
  )
}
