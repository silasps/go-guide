'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { bakeImage } from '@/lib/media/bake-image'
import { uploadVideoToBunny } from '@/lib/media/upload-bunny-video'
import { savePost } from '@/app/dashboard/publicacoes/actions'
import { usePendingAction } from '@/hooks/use-pending-action'
import { useProjectComposer } from '@/components/highlights/project-composer/project-composer-provider'
import type { MediaAspectRatio, Post, PostType } from '@/types/database'
import type { Locale } from '@/i18n/config'
import type { ComposerStep, TagDraft } from './types'
import type { MediaDraft } from '@/components/shared/media-editor/types'
import { resolveCssFilter } from '@/components/shared/media-editor/types'

interface Options {
  post?: Post
  profileId: string
  userId: string
  originalLocale: Locale
  onSaved: () => void
}

export function usePostComposer({ post, profileId, userId, originalLocale, onSaved }: Options) {
  const router = useRouter()
  const { openProjectComposer } = useProjectComposer()
  const effectiveOriginalLocale: Locale = post?.original_locale ?? originalLocale

  const [step, setStep] = useState<ComposerStep>(post ? 'details' : 'type')
  const [mediaFiles, setMediaFiles] = useState<MediaDraft[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [existingUrls, setExistingUrls] = useState<string[]>(post?.media_urls ?? [])
  const [aspect, setAspect] = useState<MediaAspectRatio>(post?.media_aspect_ratio ?? '4:5')
  const [mediaError, setMediaError] = useState<string | null>(null)

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

  const [location, setLocation] = useState(post?.location ?? '')
  const [projectId, setProjectId] = useState<string | null>(post?.project_id ?? null)
  const [tags, setTags] = useState<TagDraft[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(!!post?.scheduled_at)
  const [scheduledAt, setScheduledAt] = useState(post?.scheduled_at ? post.scheduled_at.slice(0, 16) : '')
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const { isPending: saving, run } = usePendingAction()

  // Carrega marcações já existentes (post_tags) ao editar um post publicado.
  useEffect(() => {
    if (!post?.id) return
    const supabase = createClient()
    supabase
      .from('post_tags')
      .select('id, media_index, tagged_profile_id, position_x, position_y, profile:profiles(display_name)')
      .eq('post_id', post.id)
      .then(({ data }) => {
        if (!data) return
        setTags(
          data.map((row) => ({
            id: row.id,
            mediaIndex: row.media_index,
            profileId: row.tagged_profile_id,
            displayName: (Array.isArray(row.profile) ? row.profile[0] : row.profile)?.display_name ?? '',
            x: Number(row.position_x),
            y: Number(row.position_y),
          }))
        )
      })
  }, [post?.id])

  const hasUnsavedContent = content.trim().length > 0 || mediaFiles.length > 0 || existingUrls.length !== (post?.media_urls?.length ?? 0)

  function requestClose(close: () => void) {
    if (hasUnsavedContent) setDiscardConfirmOpen(true)
    else close()
  }

  function pickProject() {
    // Fecha o composer de post e abre o de projeto no lugar — mesmo fluxo
    // fullscreen em etapas, sem navegar pra uma página separada.
    onSaved()
    openProjectComposer()
  }

  function removeExistingUrl(index: number) {
    setExistingUrls((prev) => prev.filter((_, i) => i !== index))
    setTags((prev) =>
      prev
        .filter((t) => t.mediaIndex !== index)
        .map((t) => (t.mediaIndex > index ? { ...t, mediaIndex: t.mediaIndex - 1 } : t))
    )
  }

  async function uploadMedia(): Promise<{ urls: string[]; bunnyVideoId: string | null }> {
    if (!mediaFiles.length) return { urls: [], bunnyVideoId: null }

    // Vídeo tem pipeline próprio (Bunny Stream — convertido em HLS de forma
    // assíncrona), não vai pro Supabase Storage. Só existe quando é o único
    // arquivo do post (postType 'video').
    if (mediaFiles[0].type === 'video') {
      setUploadProgress(0)
      const { bunnyVideoId } = await uploadVideoToBunny(mediaFiles[0].file, (pct) => setUploadProgress(pct))
      return { urls: [], bunnyVideoId }
    }

    const supabase = createClient()
    const urls: string[] = []
    setUploadProgress(0)

    for (let i = 0; i < mediaFiles.length; i++) {
      const media = mediaFiles[i]
      const baked = await bakeImage({
        previewUrl: media.previewUrl,
        fileName: media.file.name,
        position: media.position,
        zoom: media.zoom,
        aspect,
        cssFilter: resolveCssFilter(media),
      })
      const fileToUpload = await compressImage(baked)

      const path = `${userId}/${Date.now()}-${i}.webp`
      const { error } = await supabase.storage.from('media').upload(path, fileToUpload, { contentType: fileToUpload.type, upsert: false })
      if (error) throw new Error(error.message)

      const { data } = supabase.storage.from('media').getPublicUrl(path)
      urls.push(data.publicUrl)
      setUploadProgress(Math.round(((i + 1) / mediaFiles.length) * 100))
    }

    return { urls, bunnyVideoId: null }
  }

  async function handleTranslateWithAi(locale: Locale) {
    if (!content.trim()) return
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, sourceLocale: effectiveOriginalLocale, targetLocales: [locale], text: content }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error === 'insufficient_ai_credits' ? 'Créditos de IA insuficientes' : 'Erro ao traduzir')
        return
      }
      const translated = data.translations?.[locale]
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setTranslationSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch {
      toast.error('Erro ao traduzir')
    }
  }

  function handleSave(mode: 'draft' | 'publish') {
    if (!content.trim() && !mediaFiles.length && !existingUrls.length) {
      toast.error('Adicione uma legenda ou mídia antes de salvar.')
      return
    }

    const postType: PostType = mediaFiles.length + existingUrls.length === 0
      ? 'text'
      : mediaFiles[0]?.type === 'video'
      ? 'video'
      : mediaFiles.length + existingUrls.length > 1
      ? 'carousel'
      : 'image'

    run(true, async () => {
      try {
        const { urls: newUrls, bunnyVideoId } = await uploadMedia()
        setUploadProgress(null)
        const mediaUrls = bunnyVideoId ? [] : [...existingUrls, ...newUrls]

        const offsetTags = tags.map((tag) => ({
          mediaIndex: tag.mediaIndex,
          taggedProfileId: tag.profileId,
          x: tag.x,
          y: tag.y,
        }))

        await savePost({
          postId: post?.id,
          profileId,
          originalLocale: effectiveOriginalLocale,
          type: postType,
          content,
          mediaUrls,
          mediaBunnyVideoId: bunnyVideoId,
          mediaStatus: bunnyVideoId ? 'processing' : 'ready',
          mediaAspectRatio: aspect,
          location,
          isDraft: mode === 'draft',
          scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          projectId,
          translations: Object.fromEntries(
            Object.entries(translations).map(([locale, text]) => [
              locale,
              { content: text ?? '', source: translationSources[locale as Locale] ?? 'human' },
            ])
          ),
          tags: offsetTags,
        })

        toast.success(mode === 'draft' ? 'Rascunho salvo' : scheduleEnabled ? 'Publicação agendada' : post?.id ? 'Publicação atualizada' : 'Publicado!')
        router.refresh()
        onSaved()
      } catch (err) {
        toast.error('Não foi possível salvar a publicação.')
        console.error(err)
      } finally {
        setUploadProgress(null)
      }
    })
  }

  return {
    step, setStep,
    mediaFiles, setMediaFiles,
    activeIndex, setActiveIndex,
    existingUrls, removeExistingUrl,
    aspect, setAspect,
    mediaError, setMediaError,
    content, setContent,
    translations, setTranslations,
    translationSources, setTranslationSources,
    handleTranslateWithAi,
    effectiveOriginalLocale,
    location, setLocation,
    projectId, setProjectId,
    tags, setTags,
    scheduleEnabled, setScheduleEnabled,
    scheduledAt, setScheduledAt,
    discardConfirmOpen, setDiscardConfirmOpen,
    requestClose,
    pickProject,
    uploadProgress,
    saving,
    handleSave,
  }
}
