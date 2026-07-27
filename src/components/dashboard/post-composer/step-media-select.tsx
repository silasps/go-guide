'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Plus, X, Video as VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMediaType, validateVideo, validateVideoDuration } from '@/lib/media/compress'
import type { MediaAspectRatio } from '@/types/database'
import { createMediaDraft, type MediaDraft } from '@/components/shared/media-editor/types'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'

const MAX_MEDIA = 10

interface Props {
  mediaFiles: MediaDraft[]
  onMediaChange: (files: MediaDraft[]) => void
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
    const merged = [...mediaFiles, ...next].slice(0, MAX_MEDIA)
    onMediaChange(merged)
    if (mediaFiles.length === 0 && merged.length > 0) onActiveIndexChange(0)
  }

  function removeMedia(index: number) {
    const removed = mediaFiles[index]
    URL.revokeObjectURL(removed.previewUrl)
    const next = mediaFiles.filter((_, i) => i !== index)
    onMediaChange(next)
    if (activeIndex >= next.length) onActiveIndexChange(Math.max(0, next.length - 1))
  }

  function updateActive(patch: Partial<MediaDraft>) {
    onMediaChange(mediaFiles.map((m, i) => (i === activeIndex ? { ...m, ...patch } : m)))
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
    <div className="space-y-3">
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
