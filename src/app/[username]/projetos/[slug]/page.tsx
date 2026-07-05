import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatCurrency, getInitials } from '@/lib/utils'
import { CheckCircle2, Circle, ArrowLeft, Users } from 'lucide-react'
import { BudgetBreakdown } from '@/components/highlights/budget-breakdown'
import { FundingProjectionCard } from '@/components/highlights/funding-projection-card'

interface Props {
  params: Promise<{ username: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, privacy_mode')
    .eq('username', username)
    .single()

  if (!profile) return { title: 'Projeto não encontrado' }

  const { data: project } = await supabase
    .from('highlights')
    .select('title, description, cover_url')
    .eq('profile_id', profile.id)
    .eq('slug', slug)
    .single()

  if (!project) return { title: 'Projeto não encontrado' }

  const isIndexable = profile.privacy_mode === 'public'

  return {
    title: `${project.title} — ${profile.display_name}`,
    description: project.description ?? undefined,
    openGraph: isIndexable ? {
      title: project.title,
      description: project.description ?? '',
      images: project.cover_url ? [project.cover_url] : [],
    } : undefined,
    robots: isIndexable ? undefined : { index: false, follow: false },
  }
}

const SUPPORT_TYPES = [
  {
    key: 'financial',
    icon: '💰',
    title: 'Apoio financeiro',
    description: 'Faça uma oferta pontual ou seja parceiro fixo',
    cta: 'Faça parte',
  },
  {
    key: 'prayer',
    icon: '🙏',
    title: 'Oração',
    description: 'Comprometa-se a orar regularmente por este projeto',
    cta: 'Comprometer-me em oração',
  },
  {
    key: 'ambassador',
    icon: '📣',
    title: 'Divulgue e traga apoiadores',
    description: 'Compartilhe com sua rede e ajude este projeto a crescer',
    cta: 'Quero divulgar',
  },
  {
    key: 'volunteer',
    icon: '🤝',
    title: 'Voluntário',
    description: 'Ofereça apoio pessoal ou com suas habilidades',
    cta: 'Oferecer minha ajuda',
  },
  {
    key: 'ongoing',
    icon: '🔄',
    title: 'Parceria contínua',
    description: 'Acompanhe esta missão no longo prazo',
    cta: 'Ser parceiro de longo prazo',
  },
]

export default async function ProjetoPublicoPage({ params }: Props) {
  const { username, slug } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, privacy_mode, pix_key, paypal_url, wise_url, external_donation_url')
    .eq('username', username)
    .single()

  if (!profile) notFound()
  if (profile.privacy_mode === 'stealth') notFound()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  const projectQuery = supabase.from('highlights').select('*').eq('profile_id', profile.id).eq('status', 'active')
  const { data: project } = await (isUUID
    ? projectQuery.or(`slug.eq.${slug},id.eq.${slug}`)
    : projectQuery.eq('slug', slug)
  ).single()

  if (!project) notFound()

  const [{ data: milestones }, { data: updates }, { data: budgetCategories }, { data: pastProjects }, { count: supporterCount }] = await Promise.all([
    supabase.from('milestones').select('*').eq('highlight_id', project.id).order('order_index'),
    supabase.from('posts').select('id, content, media_urls, published_at, type')
      .eq('profile_id', profile.id).eq('project_id', project.id).eq('is_draft', false)
      .order('published_at', { ascending: false }).limit(10),
    supabase.from('project_budget_progress').select('*').eq('highlight_id', project.id).order('order_index'),
    supabase.from('highlights').select('id, slug, title, cover_url, cover_position')
      .eq('profile_id', profile.id).eq('status', 'completed').neq('id', project.id)
      .order('completed_at', { ascending: false }).limit(3),
    supabase.from('pledges').select('reporter_user_id, reporter_email', { count: 'exact', head: true })
      .eq('highlight_id', project.id).eq('status', 'confirmed'),
  ])

  const types: string[] = Array.isArray(project.goal_type) ? project.goal_type : [project.goal_type]
  const pct = project.goal_amount
    ? Math.min(100, (project.current_amount / project.goal_amount) * 100)
    : null

  const donationLink = profile.external_donation_url || profile.paypal_url || profile.wise_url || null
  const hasFinancial = types.includes('financial')
  const completedCount = milestones?.filter(m => m.is_completed).length ?? 0
  const totalMilestones = milestones?.length ?? 0

  const activeSupportTypes = SUPPORT_TYPES.filter(t => {
    if (!types.includes(t.key)) return false
    if (t.key === 'financial' && !donationLink && !profile.pix_key) return false
    return true
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Voltar */}
        <Link href={`/${username}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 -ml-2 text-muted-foreground')}>
          <ArrowLeft className="h-4 w-4" />
          {profile.display_name}
        </Link>

        {/* Hero: capa 16:9 + avatar sobreposto */}
        {project.cover_url && (
          <div className="relative aspect-video rounded-2xl overflow-hidden">
            <Image src={project.cover_url} alt={project.title} fill className="object-cover" style={{ objectPosition: project.cover_position ?? '50% 50%' }} />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full pr-3 py-1">
              <Avatar className="h-7 w-7 border-2 border-white/80">
                <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
                <AvatarFallback className="text-[10px]">{getInitials(profile.display_name)}</AvatarFallback>
              </Avatar>
              <span className="text-white text-xs font-medium">{profile.display_name}</span>
            </div>
          </div>
        )}

        {/* Cabeçalho */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.scripture && (
            <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">{project.scripture}</p>
          )}
          {project.description && <p className="text-muted-foreground">{project.description}</p>}
        </div>

        {/* Datas + apoiadores */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {project.trip_start_date && (
            <span className="px-2.5 py-1 rounded-full border">✈️ Viagem em {new Date(project.trip_start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          )}
          {project.funding_deadline && (
            <span className="px-2.5 py-1 rounded-full border">⏳ Prazo: {new Date(project.funding_deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          )}
          {(supporterCount ?? 0) > 0 && (
            <span className="px-2.5 py-1 rounded-full border flex items-center gap-1"><Users className="h-3 w-3" /> {supporterCount} apoiador(es)</span>
          )}
        </div>

        {/* Bloco financeiro em destaque — só aparece quando relevante */}
        {hasFinancial && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            {project.goal_amount && pct !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-base">{formatCurrency(project.current_amount, project.currency)} arrecadados</span>
                  <span className="text-muted-foreground">Meta: {formatCurrency(project.goal_amount, project.currency)}</span>
                </div>
                <Progress value={pct} className="h-2.5" />
                <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% da meta atingida</p>
              </div>
            )}

            {budgetCategories && budgetCategories.length > 0 && (
              <BudgetBreakdown categories={budgetCategories} currency={project.currency} />
            )}

            <Link href={`/${username}/parceria?highlight_id=${project.id}`} className={cn(buttonVariants({ size: 'lg' }), 'w-full text-base')}>
              💰 Faça parte deste projeto
            </Link>
            {profile.pix_key && (
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Chave PIX para transferência direta</p>
                <p className="font-mono text-sm font-medium select-all">{profile.pix_key}</p>
              </div>
            )}
          </div>
        )}

        {hasFinancial && project.status === 'active' && (
          <FundingProjectionCard
            raisedAmount={project.current_amount}
            goalAmount={project.goal_amount}
            currency={project.currency}
            createdAt={project.created_at}
            fundingDeadline={project.funding_deadline}
            tripStartDate={project.trip_start_date}
          />
        )}

        {/* Outras formas de apoio */}
        {activeSupportTypes.filter(t => t.key !== 'financial').length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Outras formas de apoiar</h2>
            <div className="space-y-2">
              {activeSupportTypes.filter(t => t.key !== 'financial').map(t => (
                <Link
                  key={t.key}
                  href={`/${username}/parceria?highlight_id=${project.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 hidden sm:flex')}>
                    {t.cta}
                  </span>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 sm:hidden')}>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Se não tem financeiro, mostra todos os tipos como cards */}
        {!hasFinancial && activeSupportTypes.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Como apoiar</h2>
            <div className="space-y-2">
              {activeSupportTypes.map(t => (
                <Link
                  key={t.key}
                  href={`/${username}/parceria?highlight_id=${project.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 hidden sm:flex')}>
                    {t.cta}
                  </span>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 sm:hidden')}>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Marcos */}
        {totalMilestones > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Marcos</h2>
              <span className="text-sm text-muted-foreground">{completedCount}/{totalMilestones} concluídos</span>
            </div>
            <ul className="space-y-2">
              {milestones!.map(m => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  {m.is_completed
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <span className={m.is_completed ? 'text-muted-foreground line-through' : ''}>{m.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* História por trás */}
        {project.letter && (
          <div className="space-y-3">
            <h2 className="font-semibold">A história por trás deste projeto</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {(project.letter as string).split('\n').filter((l: string) => l.trim()).map((para: string, i: number) => (
                <p key={i} className="text-sm leading-relaxed text-foreground/80 mb-3">{para}</p>
              ))}
            </div>
          </div>
        )}

        {/* Atualizações */}
        {updates && updates.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Atualizações</h2>
            <div className="space-y-4">
              {updates.map(u => (
                <div key={u.id} className="p-4 rounded-xl border bg-card space-y-2">
                  {u.media_urls?.[0] && (
                    <div className="relative h-40 rounded-lg overflow-hidden">
                      <Image src={u.media_urls[0]} alt="" fill className="object-cover" />
                    </div>
                  )}
                  {u.content && <p className="text-sm whitespace-pre-wrap">{u.content}</p>}
                  {u.published_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(u.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projetos anteriores do mesmo missionário */}
        {pastProjects && pastProjects.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Trajetória de {profile.display_name}</h2>
              <Link href={`/${username}/trajetoria`} className="text-xs text-primary hover:underline">Ver tudo</Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {pastProjects.map(p => (
                <Link key={p.id} href={`/${username}/projetos/${p.slug ?? p.id}`} className="space-y-1.5 group">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                    {p.cover_url && (
                      <Image src={p.cover_url} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
                    )}
                  </div>
                  <p className="text-xs font-medium line-clamp-2">{p.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
