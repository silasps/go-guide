import Image from 'next/image'
import Link from 'next/link'
import { Highlight } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface Props {
  projects: Highlight[]
  username: string
  accentColor: string
}

export function ProjectsSection({ projects, username, accentColor }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Projetos</h2>
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {projects.map((p) => {
          const isFinancial = p.goal_type.includes('financial')
          const pct = isFinancial && p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
          const slug = p.slug ?? p.id

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
                        src={p.cover_url}
                        alt={p.title}
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

              {/* Info principal próxima à bolinha */}
              <p className="text-[11px] font-medium leading-tight text-center line-clamp-2">{p.title}</p>

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
