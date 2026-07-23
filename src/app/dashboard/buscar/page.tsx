'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search as SearchIcon, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FollowButton } from '@/components/dashboard/feed/follow-button'
import { getInitials } from '@/lib/utils'
import { getFollowedProfileIds } from '@/app/dashboard/feed/actions'
import { useDirectorySearch } from '@/hooks/use-directory-search'

function BuscarPageInner() {
  const t = useTranslations('Search')
  const initialQuery = useSearchParams().get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const { results: displayResults, loading, hasResults, trimmedQuery } = useDirectorySearch(query)

  useEffect(() => {
    getFollowedProfileIds().then((ids) => setFollowedIds(new Set(ids)))
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          autoFocus
          className="h-11 pl-9 rounded-full"
        />
      </div>

      {trimmedQuery.length < 2 && (
        <p className="text-sm text-muted-foreground text-center py-10">{t('prompt')}</p>
      )}

      {trimmedQuery.length >= 2 && !loading && !hasResults && (
        <p className="text-sm text-muted-foreground text-center py-10">{t('noResults', { query: trimmedQuery })}</p>
      )}

      {displayResults.missionaries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionMissionaries')}</h2>
          <div className="space-y-2">
            {displayResults.missionaries.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <Link href={`/${m.username}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={m.avatar_url ?? ''} alt={m.display_name} />
                    <AvatarFallback className="text-xs">{getInitials(m.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.display_name}</p>
                    {m.show_location && m.location ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {m.location}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">@{m.username}</p>
                    )}
                  </div>
                </Link>
                <FollowButton profileId={m.id} initiallyFollowing={followedIds.has(m.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {displayResults.projects.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionProjects')}</h2>
          <div className="space-y-2">
            {displayResults.projects.map((p) => (
              <Link
                key={p.id}
                href={`/${p.profile.username}/projetos/${p.slug ?? p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-muted">
                  {p.cover_url ? (
                    <Image src={p.cover_url} alt="" width={48} height={48} className="object-cover h-full w-full" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-lg" style={{ backgroundColor: p.profile.accent_color + '20' }}>🌍</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.profile.display_name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function BuscarPage() {
  return (
    <Suspense>
      <BuscarPageInner />
    </Suspense>
  )
}
