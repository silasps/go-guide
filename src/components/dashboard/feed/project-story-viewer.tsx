'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/config'
import { ProjectStory } from '@/types/database'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { markProjectStoryViewed } from '@/app/dashboard/feed/actions'
import { X } from 'lucide-react'

interface Props {
  stories: ProjectStory[]
  initialIndex: number
  onClose: () => void
}

// Visualizador em tela cheia, tap-to-advance (sem timer automático) —
// avança pelas atualizações do projeto atual e, no fim, passa pro próximo
// projeto da faixa. "Ver projeto completo" sempre leva pra página real do
// projeto (marcos, orçamento, formas de apoiar).
export function ProjectStoryViewer({ stories, initialIndex, onClose }: Props) {
  const [storyIndex, setStoryIndex] = useState(initialIndex)
  const [postIndex, setPostIndex] = useState(0)
  const t = useTranslations('ProjectStories')
  const locale = useLocale() as Locale

  const story = stories[storyIndex]
  const post = story.posts[postIndex]

  useEffect(() => {
    markProjectStoryViewed(story.highlight.id)
  }, [story.highlight.id])

  function goNext() {
    if (postIndex < story.posts.length - 1) {
      setPostIndex(postIndex + 1)
    } else if (storyIndex < stories.length - 1) {
      setStoryIndex(storyIndex + 1)
      setPostIndex(0)
    } else {
      onClose()
    }
  }

  function goPrev() {
    if (postIndex > 0) {
      setPostIndex(postIndex - 1)
    } else if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1)
      setPostIndex(0)
    }
  }

  const { text } = resolveLocalizedText(post.content, post.original_locale, post.translations, locale)
  const media = post.media_urls?.[0]

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex gap-1 px-2 pt-3 shrink-0">
        {story.posts.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white" style={{ width: i <= postIndex ? '100%' : '0%' }} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
        <p className="text-sm font-medium text-white truncate flex-1">{story.highlight.title}</p>
        <button onClick={onClose} aria-label={t('close')} className="text-white p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 relative min-h-0">
        {media ? (
          post.type === 'video' ? (
            <video src={media} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <Image src={media} alt="" fill className="object-contain" />
          )
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center p-8"
            style={{ backgroundColor: story.profile.accent_color }}
          >
            <p className="text-white text-lg text-center whitespace-pre-wrap">{text}</p>
          </div>
        )}
        {media && text && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white text-sm whitespace-pre-wrap">{text}</p>
          </div>
        )}

        <button aria-label={t('previous')} onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3" />
        <button aria-label={t('next')} onClick={goNext} className="absolute inset-y-0 right-0 w-1/3" />
      </div>

      <Link
        href={`/${story.profile.username}/projetos/${story.highlight.slug ?? story.highlight.id}`}
        className="m-4 py-3 rounded-full bg-white text-black text-center text-sm font-medium shrink-0"
      >
        {t('viewFullProject')}
      </Link>
    </div>
  )
}
