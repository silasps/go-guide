import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Highlight, Profile } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

type ProjectWithProfile = Highlight & {
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'accent_color'>
}

// Lista somente-leitura — nunca reaproveitar HighlightsList (tem
// editar/reordenar/excluir, ações que não fazem sentido pra um parceiro).
export async function MyProjectsList({ projects }: { projects: ProjectWithProfile[] }) {
  const t = await getTranslations('PartnerFinance')

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">{t('noProjectsYet')}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {projects.map((p) => {
        const isFinancial = p.goal_type.includes('financial')
        const pct = isFinancial && p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
        const slug = p.slug ?? p.id

        return (
          <Link
            key={p.id}
            href={`/${p.profile.username}/projetos/${slug}`}
            target="_blank"
            className="p-4 rounded-2xl border bg-card space-y-2.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              {p.cover_url ? (
                <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-muted shrink-0">
                  <Image src={p.cover_url} alt={p.title} fill className="object-cover" style={{ objectPosition: p.cover_position }} />
                </div>
              ) : (
                <div
                  className="h-12 w-12 rounded-xl shrink-0 flex items-center justify-center text-lg"
                  style={{ backgroundColor: p.profile.accent_color + '20' }}
                >
                  🌍
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground truncate">{p.profile.display_name}</p>
              </div>
            </div>

            {pct !== null && (
              <div className="space-y-1">
                <Progress value={pct} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(p.current_amount, p.currency)} · {pct.toFixed(0)}%
                </p>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
