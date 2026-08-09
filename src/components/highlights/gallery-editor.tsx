'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { compressImage } from '@/lib/media/compress'

export interface GalleryImageDraft { url: string; file?: File }

const MAX_IMAGES = 10

interface Props {
  images: GalleryImageDraft[]
  onChange: (images: GalleryImageDraft[]) => void
}

export function GalleryEditor({ images, onChange }: Props) {
  const [loading, setLoading] = useState(false)
  const atLimit = images.length >= MAX_IMAGES

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const remaining = MAX_IMAGES - images.length
    const accepted = files.slice(0, remaining)
    if (files.length > accepted.length) {
      toast.error(`Máximo de ${MAX_IMAGES} fotos por projeto.`)
    }
    if (accepted.length === 0) { e.target.value = ''; return }

    setLoading(true)
    const added: GalleryImageDraft[] = []
    for (const file of accepted) {
      const compressed = await compressImage(file)
      added.push({ url: URL.createObjectURL(compressed), file: compressed })
    }
    onChange([...images, ...added])
    setLoading(false)
    e.target.value = ''
  }

  function removeImage(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
              <Image src={img.url} alt="" fill className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {atLimit ? (
        <p className="text-xs text-muted-foreground text-center">Limite de {MAX_IMAGES} fotos atingido.</p>
      ) : (
        <label className="flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer">
          <ImagePlus className="h-4 w-4" />
          {loading ? 'Processando...' : `Adicionar fotos (${images.length}/${MAX_IMAGES})`}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleSelect} disabled={loading} />
        </label>
      )}
    </div>
  )
}
