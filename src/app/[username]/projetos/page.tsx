import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency } from '@/lib/utils'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

interface Props { params: Promise<{ username: string }> }

const TYPE_LABEL: Record<string, string> = {
  financial: '💰 Financeiro', prayer: '🙏 Oração',
  ambassador: '📣 Embaixador', volunteer: '🤝 Voluntário', ongoing: '🔄 Contínuo',
}

export default async function ProjetosPublicosPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, accent_color, privacy_mode')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

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
        <div className="flex items-center gap-3">
          <Link href={`/${username}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 -ml-2 text-muted-foreground')}>
            <ArrowLeft className="h-4 w-4" />
            {profile.display_name}
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-1">Veja tudo o que {profile.display_name} está construindo e o que já foi realizado.</p>
        </div>

        {/* Projetos ativos */}
        {active.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Em andamento</h2>
            <div className="space-y-3">
              {active.map(p => <ProjectCard key={p.id} p={p} username={username} accentColor={profile.accent_color} />)}
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
            <div className="space-y-3">
              {completed.map(p => <ProjectCard key={p.id} p={p} username={username} accentColor={profile.accent_color} completed />)}
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

function ProjectCard({ p, username, accentColor, completed = false }: {
  p: { id: string; title: string; description: string | null; cover_url: string | null; cover_position: string; goal_type: string | string[]; goal_amount: number | null; current_amount: number; currency: string; slug: string | null }
  username: string
  accentColor: string
  completed?: boolean
}) {
  const types: string[] = Array.isArray(p.goal_type) ? p.goal_type : [p.goal_type]
  const pct = p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
  const slug = p.slug ?? p.id

  return (
    <Link
      href={`/${username}/projetos/${slug}`}
      className={cn(
        'flex gap-4 p-4 rounded-2xl border bg-card hover:bg-muted/50 transition-colors group',
        completed && 'opacity-70'
      )}
    >
      <div className="shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-muted">
        {p.cover_url ? (
          <Image src={p.cover_url} alt={p.title} width={64} height={64} className="object-cover h-full w-full" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-2xl" style={{ backgroundColor: accentColor + '20' }}>🌍</div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-snug">{p.title}</p>
          {completed && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
        </div>
        <div className="flex flex-wrap gap-1">
          {types.map(t => (
            <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">{TYPE_LABEL[t] ?? t}</Badge>
          ))}
        </div>
        {pct !== null && types.includes('financial') && (
          <div className="space-y-0.5">
            <Progress value={pct} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{formatCurrency(p.current_amount, p.currency)} / {formatCurrency(p.goal_amount!, p.currency)} · {pct.toFixed(0)}%</p>
          </div>
        )}
      </div>
    </Link>
  )
}
