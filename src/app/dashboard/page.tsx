import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, Heart, Sparkles, Plus, FolderOpen, ArrowRight } from 'lucide-react'
import { ProfileSetupBanner } from '@/components/dashboard/profile-setup-banner'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user!.id)
    .single()

  const [
    { count: partnersCount },
    { count: postsCount },
    { count: prayerCount },
  ] = await Promise.all([
    supabase.from('partners').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id).eq('is_draft', false),
    supabase.from('prayer_requests').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id).eq('is_answered', false),
  ])

  const stats = [
    { label: 'Parceiros', value: partnersCount ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' },
    { label: 'Publicações', value: postsCount ?? 0, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'Orações pendentes', value: prayerCount ?? 0, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40' },
    { label: 'Créditos IA', value: profile?.ai_credits ?? 0, icon: Sparkles, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  ]

  const quickActions = [
    { href: '/dashboard/publicacoes/nova', label: 'Nova publicação', icon: Plus, description: 'Compartilhe uma atualização' },
    { href: '/dashboard/projetos/novo', label: 'Novo projeto', icon: FolderOpen, description: 'Campanha ou destaque' },
  ]

  const firstName = profile?.display_name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <ProfileSetupBanner avatarUrl={profile?.avatar_url ?? null} username={profile?.username ?? ''} />

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold">Olá, {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Aqui está um resumo da sua missão.</p>
      </div>

      {/* Stats grid — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-none bg-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
                <div className={cn('p-2 rounded-lg shrink-0', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content: 2-col on desktop */}
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        {/* Recent posts */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Publicações recentes</CardTitle>
            <Link
              href="/dashboard/publicacoes"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentPosts profileId={profile!.id} />
          </CardContent>
        </Card>

        {/* Quick actions — visible on desktop as sidebar, stacked on mobile */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {quickActions.map(({ href, label, icon: Icon, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className="p-1.5 bg-muted rounded-md shrink-0 group-hover:bg-background transition-colors">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Seu perfil público</p>
              <Link
                href={`/${profile?.username}`}
                target="_blank"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full text-xs')}
              >
                Ver como parceiros veem
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

async function RecentPosts({ profileId }: { profileId: string }) {
  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, type, published_at')
    .eq('profile_id', profileId)
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .limit(5)

  if (!posts?.length) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma publicação ainda.</p>
        <Link
          href="/dashboard/publicacoes/nova"
          className={cn(buttonVariants({ size: 'sm' }), 'mt-3 gap-1.5')}
        >
          <Plus className="h-3.5 w-3.5" />
          Criar primeira publicação
        </Link>
      </div>
    )
  }

  const typeLabel: Record<string, string> = { text: 'Texto', image: 'Imagem', video: 'Vídeo', carousel: 'Álbum' }

  return (
    <ul className="divide-y">
      {posts.map((post) => (
        <li key={post.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
            {typeLabel[post.type] ?? post.type}
          </span>
          <span className="truncate text-muted-foreground flex-1">
            {post.content?.slice(0, 60) ?? '(sem texto)'}
          </span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
