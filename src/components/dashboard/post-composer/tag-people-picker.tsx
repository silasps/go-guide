'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { UserRound, X } from 'lucide-react'
import { searchTaggableProfiles, type TaggableProfile } from '@/app/dashboard/publicacoes/tag-search-actions'
import { getInitials } from '@/lib/utils'
import { ASPECT_RATIO_CLASS, resolveCssFilter, type MediaDraft } from '@/components/shared/media-editor/types'
import type { TagDraft } from './types'
import type { MediaAspectRatio } from '@/types/database'

const DEBOUNCE_MS = 300

interface Props {
  profileId: string
  media: MediaDraft
  mediaIndex: number
  aspect: MediaAspectRatio
  tags: TagDraft[]
  onAddTag: (tag: TagDraft) => void
  onRemoveTag: (id: string) => void
}

export function TagPeoplePicker({ profileId, media, mediaIndex, aspect, tags, onAddTag, onRemoveTag }: Props) {
  const t = useTranslations('PostComposer')
  const frameRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaggableProfile[]>([])

  const trimmedQuery = query.trim()

  useEffect(() => {
    if (!pending || trimmedQuery.length < 2) return
    let cancelled = false
    const id = setTimeout(() => {
      searchTaggableProfiles(profileId, trimmedQuery).then((data) => { if (!cancelled) setResults(data) })
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(id) }
  }, [trimmedQuery, pending, profileId])

  const visibleResults = pending && trimmedQuery.length >= 2 ? results : []

  function handleFrameClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPending({ x, y })
    setQuery('')
  }

  function pickResult(profile: TaggableProfile) {
    if (!pending) return
    onAddTag({ id: crypto.randomUUID(), mediaIndex, profileId: profile.id, displayName: profile.display_name, x: pending.x, y: pending.y })
    setPending(null)
  }

  const mediaTags = tags.filter((tag) => tag.mediaIndex === mediaIndex)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('tagPeopleHint')}</p>
      <div
        ref={frameRef}
        onClick={handleFrameClick}
        className={`relative w-full overflow-hidden rounded-lg cursor-crosshair ${ASPECT_RATIO_CLASS[aspect] || 'aspect-[4/5]'}`}
        style={{ backgroundColor: media.bgColor }}
      >
        <Image
          src={media.previewUrl}
          alt=""
          fill
          className="object-contain pointer-events-none"
          style={{
            // Mesma técnica do ImageCropEditor/StepAdjust (object-contain +
            // object-position fixo + translate depois de scale) — sem isso,
            // a prévia da etapa "Detalhes" (e o clique pra marcar pessoas,
            // que usa esse mesmo quadro como referência) mostrava um
            // enquadramento diferente do que o usuário ajustou no corte.
            // `bgColor` vem de `MediaDraft` (ver StepMediaSelect), não de
            // `onLoad` aqui — não dispara de forma confiável pra uma blob
            // URL já em cache do navegador.
            objectPosition: '50% 50%',
            transform: `translate(${media.position.x - 50}%, ${media.position.y - 50}%) scale(${media.zoom})`,
            filter: resolveCssFilter(media) || undefined,
          }}
        />

        {mediaTags.map((tag) => (
          <div
            key={tag.id}
            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-black/70 text-white text-xs rounded-full pl-1 pr-1.5 py-0.5"
          >
            <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
              <UserRound className="h-2.5 w-2.5" />
            </span>
            {tag.displayName}
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveTag(tag.id) }} aria-label={t('removeTag')}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {pending && (
          <div
            style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-56 bg-popover text-popover-foreground rounded-lg shadow-lg ring-1 ring-foreground/10 p-2 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('tagSearchPlaceholder')}
              className="w-full text-sm bg-transparent border-b px-1 py-1 outline-none"
            />
            <div className="max-h-40 overflow-y-auto overflow-x-hidden">
              {visibleResults.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => pickResult(profile)}
                  className="flex items-center gap-2 w-full rounded-md px-1.5 py-1 text-sm hover:bg-muted text-left"
                >
                  <span className="h-6 w-6 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] overflow-hidden">
                    {profile.avatar_url ? (
                      <Image src={profile.avatar_url} alt="" width={24} height={24} className="h-full w-full object-cover" />
                    ) : getInitials(profile.display_name)}
                  </span>
                  <span className="truncate">{profile.display_name}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPending(null)} className="text-xs text-muted-foreground hover:text-foreground">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
