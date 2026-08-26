import Image from 'next/image'
import { coverThumbnailSrc } from '@/lib/media/bunny-thumbnail'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Highlight } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { formatCurrency } from '@/lib/utils'

interface Props {
  projects: Highlight[]
  username: string
  accentColor: string
  visitorLocale: Locale
}

export async function ProjectsSection({ projects, username, accentColor, visitorLocale }: Props) {
  const t = await getTranslations('PublicProfile')

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('projectsHeading')}</h2>
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {projects.map((p) => {
          const isFinancial = p.goal_type.includes('financial')
          const pct = isFinancial && p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
          const slug = p.slug ?? p.id
          const title = resolveLocalizedText(p.title, p.original_locale, p.title_translations, visitorLocale).text ?? p.title

          return (
            <Link
              key={p.id}
              href={`/${username}/projetos/${slug}`}
              className="flex flex-col items-center gap-1.5 w-[76px] shrink-0 snap-start group"
            >
              {/* Bolinha estilo destaque do Instagram */}
              <div
                className="h-16 w-16 rounded-full p-[2px] shrink-0"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}80)` }}
              >
                <div className="h-full w-full rounded-full overflow-hidden bg-background p-[2px]">
                  <div className="h-full w-full rounded-full overflow-hidden bg-muted">
                    {p.cover_url ? (
                      <Image
                        src={coverThumbnailSrc(p.cover_url)}
                        alt={title}
                        width={64}
                        height={64}
                        className="object-cover h-full w-full group-hover:scale-105 transition-transform"
                        style={{ objectPosition: p.cover_position ?? '50% 50%' }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-lg" style={{ backgroundColor: accentColor + '20' }}>
                        🌍
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info principal próxima à bolinha — bloco de altura fixa (2
                  linhas) com o texto ancorado no topo, senão títulos de 1
                  linha deixam a barra de progresso em alturas diferentes,
                  desalinhando a fileira. min-h sozinho no <p> com line-clamp
                  não é suficiente porque -webkit-box (usado pelo line-clamp)
                  centraliza o texto verticalmente dentro da própria caixa. */}
              <div className="h-[2.2em] w-full flex items-start justify-center">
                <p className="text-[11px] font-medium leading-tight text-center line-clamp-2">{title}</p>
              </div>

              {pct !== null && (
                <div className="w-full space-y-0.5">
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accentColor }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {pct.toFixed(0)}%
                  </p>
                </div>
              )}

              {pct === null && isFinancial && p.current_amount > 0 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  {formatCurrency(p.current_amount, p.currency)}
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
