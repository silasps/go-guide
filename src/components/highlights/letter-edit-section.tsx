'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ImagePlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { uniqueFileName } from './cover-editor'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent } from '@/lib/i18n/content-translations'
import type { Locale } from '@/i18n/config'
import type { SectionProps } from './section-types'

interface ImageDraft { url: string; file?: File }

function toDraft(url: string | null): ImageDraft {
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

function StoryImageField({ label, draft, onChange, captionValue, onCaptionChange, captionPlaceholder, uploadLabel, changeLabel, processingLabel }: StoryImageFieldProps) {
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

export function LetterEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  // Sem história ainda: abre o modal já no formulário de edição, em vez do
  // estado vazio + botão de lápis — evitava um passo a mais só pra chegar
  // onde a pessoa já queria ir (pedido do usuário, "muitos passos pra
  // editar a história").
  const [editing, setEditing] = useState(canEdit && !snapshot.letter)
  const [value, setValue] = useState(snapshot.letter)
  const [translations, setTranslations] = useState(() => initialTranslations(snapshot.letterTranslations))
  const [sources, setSources] = useState(() => initialSources(snapshot.letterTranslations))
  const [image1, setImage1] = useState<ImageDraft>(() => toDraft(snapshot.letterImageUrl))
  const [imageCaption, setImageCaption] = useState(snapshot.letterImageCaption ?? '')
  const [image2, setImage2] = useState<ImageDraft>(() => toDraft(snapshot.letterImageUrl2))
  const [imageCaption2, setImageCaption2] = useState(snapshot.letterImageCaption2 ?? '')

  async function translateField(locale: Locale) {
    try {
      const translated = await translateContent(profileId, snapshot.originalLocale, locale, value)
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg === 'insufficient_ai_credits' ? t('insufficientAiCredits') : t('translateError'))
    }
  }

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionLetter') })}
          onClick={() => {
            setValue(snapshot.letter)
            setTranslations(initialTranslations(snapshot.letterTranslations))
            setSources(initialSources(snapshot.letterTranslations))
            setImage1(toDraft(snapshot.letterImageUrl))
            setImageCaption(snapshot.letterImageCaption ?? '')
            setImage2(toDraft(snapshot.letterImageUrl2))
            setImageCaption2(snapshot.letterImageCaption2 ?? '')
            setEditing(true)
          }}
        />
      </div>
    )
  }

  // Igual ao padrão de upload já usado em GalleryEditSection: seleção +
  // compressão acontecem na hora (StoryImageField), o upload de verdade pro
  // Storage só roda aqui, no momento de salvar — evita subir imagem de
  // rascunho que a pessoa pode descartar ao cancelar a edição.
  async function resolveImageUrl(draft: ImageDraft, userId: string): Promise<string | null> {
    if (!draft.file) return draft.url.trim() || null
    const supabase = createClient()
    const path = `${userId}/highlights/${uniqueFileName('webp')}`
    const { error } = await supabase.storage.from('media').upload(path, draft.file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  async function handleSave() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [letterImageUrl, letterImageUrl2] = await Promise.all([
      resolveImageUrl(image1, user.id),
      resolveImageUrl(image2, user.id),
    ])
    if ((image1.file && !letterImageUrl) || (image2.file && !letterImageUrl2)) {
      toast.error(t('saveError'))
      return
    }

    const ok = await save({
      ...snapshot,
      highlightId,
      profileId,
      letter: value,
      letterTranslations: buildTranslationsPayload(snapshot.originalLocale, translations, sources),
      letterImageUrl,
      letterImageCaption: imageCaption.trim() || null,
      letterImageUrl2,
      letterImageCaption2: imageCaption2.trim() || null,
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <LocaleContentTabs
        originalLocale={snapshot.originalLocale}
        originalText={value}
        onOriginalChange={setValue}
        translations={translations}
        onTranslationChange={(locale, text) => { setTranslations((prev) => ({ ...prev, [locale]: text })); setSources((prev) => ({ ...prev, [locale]: 'human' })) }}
        onTranslateWithAi={translateField}
        rows={8}
        maxLength={2000}
      />
      <StoryImageField
        label={t('letterImageLabel')}
        draft={image1}
        onChange={setImage1}
        captionValue={imageCaption}
        onCaptionChange={setImageCaption}
        captionPlaceholder={t('letterImageCaptionPlaceholder')}
        uploadLabel={t('letterImageUpload')}
        changeLabel={t('letterImageChange')}
        processingLabel={t('letterImageProcessing')}
      />
      <StoryImageField
        label={t('letterImageLabel2')}
        draft={image2}
        onChange={setImage2}
        captionValue={imageCaption2}
        onCaptionChange={setImageCaption2}
        captionPlaceholder={t('letterImageCaptionPlaceholder')}
        uploadLabel={t('letterImageUpload')}
        changeLabel={t('letterImageChange')}
        processingLabel={t('letterImageProcessing')}
      />
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
