import Image from 'next/image'
import Link from 'next/link'
import { Highlight } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

interface Props {
  projects: Highlight[]
  username: string
  accentColor: string
}

const GOAL_TYPE_LABEL: Record<string, string> = {
  financial:  '💰 Financeiro',
  prayer:     '🙏 Oração',
  ambassador: '📣 Embaixador',
  volunteer:  '🤝 Voluntário',
  ongoing:    '🔄 Contínuo',
}

export function ProjectsSection({ projects, username, accentColor }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Projetos</h2>
      <div className="space-y-3">
        {projects.map((p) => {
          const pct = p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
          const slug = p.slug ?? p.id

          return (
            <Link
              key={p.id}
              href={`/${username}/projetos/${slug}`}
              className="flex gap-4 p-4 rounded-2xl border bg-card hover:bg-muted/50 transition-colors group"
            >
              {/* Capa */}
              <div className="shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-muted">
                {p.cover_url ? (
                  <Image src={p.cover_url} alt={p.title} width={64} height={64} className="object-cover h-full w-full" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl" style={{ backgroundColor: accentColor + '20' }}>
                    🌍
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug">{p.title}</p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(p.goal_type) ? p.goal_type : [p.goal_type]).map(t => (
                    <Badge key={t} variant="secondary" className="text-xs px-2 py-0">
                      {GOAL_TYPE_LABEL[t] ?? t}
                    </Badge>
                  ))}
                </div>

                {pct !== null && (Array.isArray(p.goal_type) ? p.goal_type : [p.goal_type]).includes('financial') && (
                  <div className="space-y-1">
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(p.current_amount, p.currency)} / {formatCurrency(p.goal_amount!, p.currency)} · {pct.toFixed(0)}%
                    </p>
                  </div>
                )}

                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
