'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { coverThumbnailSrc } from '@/lib/media/bunny-thumbnail'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency } from '@/lib/utils'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/i18n/config'
import type { Highlight } from '@/types/database'
import { CheckCircle2 } from 'lucide-react'
import { ProjectCardMenu } from './project-card-menu'

const TYPE_LABEL: Record<string, string> = {
  financial: '💰 Financeiro', prayer: '🙏 Oração',
  ambassador: '📣 Embaixador', volunteer: '🤝 Voluntário', ongoing: '🔄 Contínuo',
}

interface Props {
  projects: Highlight[]
  username: string
  accentColor: string
  visitorLocale: Locale
  canEdit: boolean
  completed?: boolean
}

// Grade de projetos com reordenar embutido no menu (⋮) de cada card — as
// mesmas ações que antes só existiam na lista do dashboard (ver
// highlights-list.tsx) agora moram aqui também, a pedido do usuário
// ("coloque elas dentro dos 3 pontinhos"). Precisa ser client (ao
// contrário do `ProjectCard` que existia solto na Server Component da
// página) porque mover um card depende de estado local da lista inteira,
// não só do card clicado.
export function ProjectGrid({ projects: initial, username, accentColor, visitorLocale, canEdit, completed = false }: Props) {
  const [projects, setProjects] = useState(initial)

  async function move(idx: number, dir: -1 | 1) {
    const next = [...projects]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]

    const supabase = createClient()
    await Promise.all([
      supabase.from('highlights').update({ order_index: idx }).eq('id', next[idx].id),
      supabase.from('highlights').update({ order_index: target }).eq('id', next[target].id),
    ])
    setProjects(next)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {projects.map((p, idx) => {
        const types: string[] = Array.isArray(p.goal_type) ? p.goal_type : [p.goal_type]
        const pct = p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
        const slug = p.slug ?? p.id
        const title = resolveLocalizedText(p.title, p.original_locale, p.title_translations, visitorLocale).text ?? p.title

        return (
          <div key={p.id} className="relative">
            <Link
              href={`/${username}/projetos/${slug}`}
              className={cn(
                'flex flex-col rounded-2xl border bg-card overflow-hidden hover:bg-muted/50 transition-colors group',
                completed && 'opacity-70'
              )}
            >
              <div className="relative aspect-[4/3] bg-muted">
                {p.cover_url ? (
                  <Image
                    src={coverThumbnailSrc(p.cover_url)}
                    alt={title}
                    fill
                    sizes="50vw"
                    className="object-cover group-hover:scale-105 transition-transform"
                    style={{ objectPosition: p.cover_position ?? '50% 50%' }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-3xl" style={{ backgroundColor: accentColor + '20' }}>🌍</div>
                )}
                {completed && (
                  <div className="absolute top-2 left-2 bg-background/90 backdrop-blur rounded-full p-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 p-3 space-y-1.5">
                <p className="font-medium text-sm leading-snug line-clamp-2">{title}</p>
                <div className="flex flex-wrap gap-1">
                  {types.slice(0, 2).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{TYPE_LABEL[t] ?? t}</Badge>
                  ))}
                </div>
                {pct !== null && types.includes('financial') && (
                  <div className="space-y-0.5">
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% · {formatCurrency(p.current_amount, p.currency)}</p>
                  </div>
                )}
              </div>
            </Link>
            {canEdit && (
              <ProjectCardMenu
                projectId={p.id}
                profileId={p.profile_id}
                projectTitle={title}
                status={p.status}
                openHref={`/${username}/projetos/${slug}`}
                editHref={`/dashboard/projetos/${p.id}`}
                onMoveUp={idx > 0 ? () => move(idx, -1) : undefined}
                onMoveDown={idx < projects.length - 1 ? () => move(idx, 1) : undefined}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
