'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { bakeImage } from '@/lib/media/bake-image'
import { createMediaDraft, type MediaDraft } from '@/components/shared/media-editor/types'
import { ImageCropEditor } from '@/components/shared/media-editor/image-crop-editor'

interface Props {
  file: File | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (file: File) => void
}

// Reaproveita o mesmo ImageCropEditor (arrastar livre + zoom por
// botão/scroll/pinça) usado na capa de perfil e no composer de post/projeto
// — mesma experiência de posicionamento em todo o sistema, só que num
// quadro circular e sempre 1:1.
export function AvatarCropDialog({ file, open, onOpenChange, onApply }: Props) {
  const t = useTranslations('ProfileForm')
  const [media, setMedia] = useState<MediaDraft | null>(null)

  useEffect(() => {
    const draft = file ? createMediaDraft(file, 'image') : null
    const id = setTimeout(() => setMedia(draft), 0)
    return () => {
      clearTimeout(id)
      if (draft) URL.revokeObjectURL(draft.previewUrl)
    }
  }, [file])

  async function handleApply() {
    if (!media) return
    const baked = await bakeImage({
      previewUrl: media.previewUrl,
      fileName: 'avatar.jpg',
      position: media.position,
      zoom: media.zoom,
      aspect: '1:1',
    })
    onApply(baked)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-auto max-w-none sm:max-w-none p-4 gap-4">
        <DialogTitle className="text-center">{t('adjustPhoto')}</DialogTitle>

        {media && (
          <div className="mx-auto w-[280px]">
            <ImageCropEditor
              media={media}
              aspect="1:1"
              onAspectChange={() => {}}
              onPositionChange={(position) => setMedia((prev) => (prev ? { ...prev, position } : prev))}
              onZoomChange={(zoom) => setMedia((prev) => (prev ? { ...prev, zoom } : prev))}
              showAspectPicker={false}
              round
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            {t('usePhoto')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
