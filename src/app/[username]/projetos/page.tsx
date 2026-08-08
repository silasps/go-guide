import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency } from '@/lib/utils'
import { getProfile } from '@/lib/profile/get-profile'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import type { Locale } from '@/i18n/config'
import type { Highlight } from '@/types/database'
import { CheckCircle2 } from 'lucide-react'

interface Props { params: Promise<{ username: string }> }

const TYPE_LABEL: Record<string, string> = {
  financial: '💰 Financeiro', prayer: '🙏 Oração',
  ambassador: '📣 Embaixador', volunteer: '🤝 Voluntário', ongoing: '🔄 Contínuo',
}

export default async function ProjetosPublicosPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const visitorLocale = (await getLocale()) as Locale
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('highlights')
    .select('*')
    .eq('profile_id', profile.id)
    .neq('status', 'hidden')
    .order('status') // active antes de completed
    .order('order_index')

  const active = projects?.filter(p => p.status === 'active') ?? []
  const completed = projects?.filter(p => p.status === 'completed') ?? []

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-1">Veja tudo o que {profile.display_name} está construindo e o que já foi realizado.</p>
        </div>

        {/* Projetos ativos */}
        {active.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Em andamento</h2>
            <div className="grid grid-cols-2 gap-3">
              {active.map(p => <ProjectCard key={p.id} p={p} username={username} accentColor={profile.accent_color} visitorLocale={visitorLocale} />)}
            </div>
          </section>
        )}

        {/* Projetos concluídos */}
        {completed.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Concluídos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {completed.map(p => <ProjectCard key={p.id} p={p} username={username} accentColor={profile.accent_color} visitorLocale={visitorLocale} completed />)}
            </div>
          </section>
        )}

        {!projects?.length && (
          <p className="text-center text-muted-foreground py-12">Nenhum projeto publicado ainda.</p>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ p, username, accentColor, visitorLocale, completed = false }: {
  p: Highlight
  username: string
  accentColor: string
  visitorLocale: Locale
  completed?: boolean
}) {
  const types: string[] = Array.isArray(p.goal_type) ? p.goal_type : [p.goal_type]
  const pct = p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
  const slug = p.slug ?? p.id
  const title = resolveLocalizedText(p.title, p.original_locale, p.title_translations, visitorLocale).text ?? p.title

  return (
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
            src={p.cover_url}
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
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur rounded-full p-1">
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
  )
}
