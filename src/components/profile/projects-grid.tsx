import Image from 'next/image'
import Link from 'next/link'
import { Highlight } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'

interface Props {
  projects: Highlight[]
  username: string
  accentColor: string
  visitorLocale: Locale
}

/** Grade 3 colunas dos projetos, mesmo peso visual da grade de posts —
 *  clicar leva direto pros detalhes (meta, marcos, formas de apoiar), já
 *  que um projeto é conteúdo rico demais pro visualizador arrastável. */
export function ProjectsGrid({ projects, username, accentColor, visitorLocale }: Props) {
  return (
    <div className="grid grid-cols-3 gap-0.5 -mx-4">
      {projects.map((p) => {
        const slug = p.slug ?? p.id
        const title = resolveLocalizedText(p.title, p.original_locale, p.title_translations, visitorLocale).text ?? p.title
        return (
          <Link key={p.id} href={`/${username}/projetos/${slug}`} className="relative aspect-[4/5] bg-muted overflow-hidden group">
            {p.cover_url ? (
              <Image
                src={p.cover_url}
                alt={title}
                fill
                sizes="33vw"
                className="object-cover group-hover:scale-105 transition-transform"
                style={{ objectPosition: p.cover_position ?? '50% 50%' }}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-2xl" style={{ backgroundColor: accentColor + '20' }}>🌍</div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
              <p className="text-[11px] font-medium text-white line-clamp-1">{title}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
