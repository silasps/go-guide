'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { compressImage, validateVideo, validateVideoDuration, getMediaType, formatFileSize, VIDEO_MAX_SIZE_MB } from '@/lib/media/compress'
import { savePost } from '@/app/dashboard/publicacoes/actions'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { toast } from 'sonner'
import { ImagePlus, Video, X, Loader2, AlertCircle } from 'lucide-react'
import { Post, PostType } from '@/types/database'
import type { Locale } from '@/i18n/config'

interface Props {
  post?: Post
  profileId: string
  userId: string
  originalLocale: Locale
}

type MediaFile = {
  file: File
  preview: string
  type: 'image' | 'video'
}

export function PostEditor({ post, profileId, userId, originalLocale }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effectiveOriginalLocale: Locale = post?.original_locale ?? originalLocale
  const [content, setContent] = useState(post?.content ?? '')
  const [translations, setTranslations] = useState<Partial<Record<Locale, string>>>(() => {
    const t: Partial<Record<Locale, string>> = {}
    for (const [locale, v] of Object.entries(post?.translations ?? {})) t[locale as Locale] = v.content
    return t
  })
  const [translationSources, setTranslationSources] = useState<Partial<Record<Locale, 'ai' | 'human'>>>(() => {
    const s: Partial<Record<Locale, 'ai' | 'human'>> = {}
    for (const [locale, v] of Object.entries(post?.translations ?? {})) s[locale as Locale] = v.source
    return s
  })
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [existingUrls] = useState<string[]>(post?.media_urls ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const { isPending: saving, run } = usePendingAction()

  const postType: PostType = mediaFiles.length === 0 && existingUrls.length === 0
    ? 'text'
    : mediaFiles[0]?.type === 'video'
    ? 'video'
    : mediaFiles.length > 1 || existingUrls.length > 1
    ? 'carousel'
    : 'image'

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return
    setMediaError(null)

    const newFiles: MediaFile[] = []

    for (const file of Array.from(files)) {
      const mediaType = getMediaType(file)
      if (mediaType === 'unknown') {
        setMediaError('Formato não suportado. Use imagens ou vídeos.')
        continue
      }

      if (mediaType === 'video') {
        const validation = validateVideo(file)
        if (!validation.valid) {
          setMediaError(validation.error!)
          continue
        }
        const durationCheck = await validateVideoDuration(file)
        if (!durationCheck.valid) {
          setMediaError(durationCheck.error!)
          continue
        }
        newFiles.push({ file, preview: URL.createObjectURL(file), type: 'video' })
      } else {
        const compressed = await compressImage(file)
        newFiles.push({ file: compressed, preview: URL.createObjectURL(compressed), type: 'image' })
      }
    }

    setMediaFiles(prev => [...prev, ...newFiles].slice(0, 10))
  }, [])

  function removeMedia(index: number) {
    setMediaFiles(prev => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  async function uploadMedia(): Promise<string[]> {
    if (!mediaFiles.length) return existingUrls

    const supabase = createClient()
    const urls: string[] = []
    setUploadProgress(0)

    for (let i = 0; i < mediaFiles.length; i++) {
      const { file, type } = mediaFiles[i]
      const ext = type === 'video' ? file.name.split('.').pop() : 'webp'
      const path = `${userId}/${Date.now()}-${i}.${ext}`

      const { error } = await supabase.storage
        .from('media')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (error) throw new Error(error.message)

      const { data } = supabase.storage.from('media').getPublicUrl(path)
      urls.push(data.publicUrl)
      setUploadProgress(Math.round(((i + 1) / mediaFiles.length) * 100))
    }

    return [...existingUrls, ...urls]
  }

  async function handleTranslateWithAi(locale: Locale) {
    if (!content.trim()) return
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          sourceLocale: effectiveOriginalLocale,
          targetLocales: [locale],
          text: content,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'insufficient_ai_credits') {
          toast.error('Créditos de IA insuficientes.', {
            action: { label: 'Ver planos', onClick: () => router.push('/planos') },
          })
        } else {
          toast.error('Erro ao traduzir. Tente novamente.')
        }
        return
      }
      const translated = data.translations?.[locale]
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setTranslationSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch {
      toast.error('Erro ao traduzir. Tente novamente.')
    }
  }

  function handleSave(isDraft: boolean) {
    if (!content.trim() && !mediaFiles.length && !existingUrls.length) {
      toast.error('Adicione texto ou mídia antes de salvar.')
      return
    }

    run(true, async () => {
      setUploading(mediaFiles.length > 0)

      try {
        const mediaUrls = await uploadMedia()
        setUploading(false)

        await savePost({
          postId: post?.id,
          profileId,
          originalLocale: effectiveOriginalLocale,
          type: postType,
          content,
          mediaUrls,
          isDraft,
          translations: Object.fromEntries(
            Object.entries(translations).map(([locale, text]) => [
              locale,
              { content: text ?? '', source: translationSources[locale as Locale] ?? 'human' },
            ])
          ),
        })

        toast.success(isDraft ? 'Rascunho salvo.' : 'Publicado!')
        router.push('/dashboard/publicacoes')
        router.refresh()
      } catch (err) {
        toast.error('Erro ao salvar. Tente novamente.')
        console.error(err)
      } finally {
        setUploading(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Content */}
      <div className="space-y-2">
        <Label>Texto</Label>
        <LocaleContentTabs
          originalLocale={effectiveOriginalLocale}
          preferredLocale={originalLocale}
          originalText={content}
          onOriginalChange={setContent}
          translations={translations}
          onTranslationChange={(locale, value) => {
            setTranslations((prev) => ({ ...prev, [locale]: value }))
            setTranslationSources((prev) => ({ ...prev, [locale]: 'human' }))
          }}
          onTranslateWithAi={handleTranslateWithAi}
          originalPlaceholder="Compartilhe o que Deus está fazendo..."
        />
      </div>

      {/* Media error */}
      {mediaError && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{mediaError}</p>
        </div>
      )}

      {/* Media preview */}
      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {mediaFiles.map((m, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
              {m.type === 'video' ? (
                <video src={m.preview} className="h-full w-full object-cover" />
              ) : (
                <Image src={m.preview} alt="" fill className="object-cover" />
              )}
              <button
                onClick={() => removeMedia(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Enviando mídia... {uploadProgress}%</p>
          <Progress value={uploadProgress} className="h-1.5" />
        </div>
      )}

      {/* Post type badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{postType}</Badge>
        {mediaFiles.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {mediaFiles.map(m => formatFileSize(m.file.size)).join(', ')}
          </span>
        )}
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          title="Adicionar imagem"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = 'video/*'
              fileInputRef.current.click()
              fileInputRef.current.accept = 'image/*,video/*'
            }
          }}
          className="gap-1.5"
        >
          <Video className="h-4 w-4" />
          <span className="text-xs text-muted-foreground">Máx {VIDEO_MAX_SIZE_MB}MB</span>
        </Button>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            Salvar rascunho
          </Button>
          <Button
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publicar
          </Button>
        </div>
      </div>
    </div>
  )
}
