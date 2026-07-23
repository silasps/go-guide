'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search as SearchIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { useDirectorySearch } from '@/hooks/use-directory-search'

// Barra de busca fixa no header do dashboard desktop, estilo Instagram web
// (dropdown de resultados ao vivo sobre a página, sem navegar). No mobile
// o header continua só com o ícone -> /dashboard/buscar em tela cheia,
// que é como o app do Instagram faz (aba dedicada, não barra persistente).
export function HeaderSearch() {
  const t = useTranslations('Search')
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { results, loading, hasResults, trimmedQuery } = useDirectorySearch(query)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function goToFullSearch() {
    if (trimmedQuery.length < 2) return
    setOpen(false)
    router.push(`/dashboard/buscar?q=${encodeURIComponent(trimmedQuery)}`)
  }

  return (
    <div ref={containerRef} className="relative hidden md:block w-full max-w-xs">
      <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && goToFullSearch()}
        placeholder={t('placeholder')}
        className="h-9 w-full rounded-full border border-transparent bg-muted pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:bg-background"
      />

      {open && trimmedQuery.length >= 2 && (
        <div className="absolute left-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover shadow-lg ring-1 ring-foreground/10 p-2 z-50">
          {!loading && !hasResults && (
            <p className="text-sm text-muted-foreground text-center py-6">{t('noResults', { query: trimmedQuery })}</p>
          )}

          {results.missionaries.length > 0 && (
            <div className="space-y-0.5">
              <h2 className="px-2 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionMissionaries')}</h2>
              {results.missionaries.map((m) => (
                <Link
                  key={m.id}
                  href={`/${m.username}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={m.avatar_url ?? ''} alt={m.display_name} />
                    <AvatarFallback className="text-xs">{getInitials(m.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{m.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div className="space-y-0.5 mt-1">
              <h2 className="px-2 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionProjects')}</h2>
              {results.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/${p.profile.username}/projetos/${p.slug ?? p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="shrink-0 h-8 w-8 rounded-md overflow-hidden bg-muted">
                    {p.cover_url && (
                      <Image src={p.cover_url} alt="" width={32} height={32} className="object-cover h-full w-full" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.profile.display_name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
