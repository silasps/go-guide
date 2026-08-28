'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Plus, X, Video as VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMediaType, validateVideo, validateVideoDuration } from '@/lib/media/compress'
import { averageColorFromUrl } from '@/lib/media/bake-image'
import type { MediaAspectRatio } from '@/types/database'
import { createMediaDraft, type MediaDraft } from '@/components/shared/media-editor/types'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'

const MAX_MEDIA = 10

interface Props {
  mediaFiles: MediaDraft[]
  onMediaChange: (files: MediaDraft[] | ((prev: MediaDraft[]) => MediaDraft[])) => void
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  aspect: MediaAspectRatio
  onAspectChange: (aspect: MediaAspectRatio) => void
  onError: (message: string) => void
}

export function StepMediaSelect({
  mediaFiles, onMediaChange, activeIndex, onActiveIndexChange, aspect, onAspectChange, onError,
}: Props) {
  const t = useTranslations('PostComposer')
  const inputRef = useRef<HTMLInputElement>(null)
  const active = mediaFiles[activeIndex]

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const next: MediaDraft[] = []
    for (const file of Array.from(fileList)) {
      const mediaType = getMediaType(file)
      if (mediaType === 'unknown') { onError(t('unsupportedFormat')); continue }
      if (mediaType === 'video') {
        const validation = validateVideo(file)
        if (!validation.valid) { onError(validation.error!); continue }
        const durationCheck = await validateVideoDuration(file)
        if (!durationCheck.valid) { onError(durationCheck.error!); continue }
      }
      next.push(createMediaDraft(file, mediaType))
    }
    const wasEmpty = mediaFiles.length === 0
    onMediaChange((prev) => [...prev, ...next].slice(0, MAX_MEDIA))
    if (wasEmpty && next.length > 0) onActiveIndexChange(0)

    // Cor média calculada uma vez aqui (não em cada preview via onLoad, que
    // não dispara de forma confiável pra uma blob URL já em cache — ver
    // MediaDraft.bgColor) e propagada pelo id assim que resolve.
    for (const draft of next) {
      if (draft.type !== 'image') continue
      averageColorFromUrl(draft.previewUrl).then((bgColor) => {
        onMediaChange((prev) => prev.map((m) => (m.id === draft.id ? { ...m, bgColor } : m)))
      }).catch(() => {})
    }
  }

  function removeMedia(index: number) {
    const removed = mediaFiles[index]
    URL.revokeObjectURL(removed.previewUrl)
    const next = mediaFiles.filter((_, i) => i !== index)
    onMediaChange((prev) => prev.filter((_, i) => i !== index))
    if (activeIndex >= next.length) onActiveIndexChange(Math.max(0, next.length - 1))
  }

  // Forma funcional (prev => ...) em vez de mediaFiles.map(...) direto: o
  // ImageCropEditor chama onZoomChange e onPositionChange em sequência
  // síncrona a cada mudança de zoom (setZoom reenquadra a posição junto).
  // Com a forma antiga, as duas chamadas partiam do mesmo `mediaFiles` da
  // closure (ainda não atualizado pela primeira) — a segunda sempre
  // sobrescrevia o zoom da primeira de volta pro valor antigo, e o zoom
  // nunca avançava visualmente (bug real, não só passo pequeno; feedback
  // direto do usuário, reproduzido com sessão real + upload real via
  // Playwright). A forma funcional sempre parte do estado mais recente.
  function updateActive(patch: Partial<MediaDraft>) {
    onMediaChange((prev) => prev.map((m, i) => (i === activeIndex ? { ...m, ...patch } : m)))
  }

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button type="button" onClick={() => inputRef.current?.click()} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('selectFromDevice')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-md mx-auto">
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {active.type === 'video' ? (
        <video src={active.previewUrl} controls className="w-full rounded-lg bg-black aspect-video" />
      ) : (
        <ImageCropEditor
          media={active}
          aspect={aspect}
          onAspectChange={onAspectChange}
          onPositionChange={(position) => updateActive({ position })}
          onZoomChange={(zoom) => updateActive({ zoom })}
        />
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {mediaFiles.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onActiveIndexChange(i)}
            className={cn(
              'relative h-14 w-14 shrink-0 rounded-md overflow-hidden ring-2',
              i === activeIndex ? 'ring-primary' : 'ring-transparent'
            )}
          >
            {m.type === 'video' ? (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <VideoIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <Image src={m.previewUrl} alt="" fill className="object-cover" />
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); removeMedia(i) }}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}

        {mediaFiles.length < MAX_MEDIA && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-14 w-14 shrink-0 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={t('addImage')}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
