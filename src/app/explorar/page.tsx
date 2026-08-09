import Link from 'next/link'
import Image from 'next/image'
import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { enrichWithEngagement } from '@/lib/posts/enrich-with-engagement'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { ProfilePostsGrid } from '@/components/shared/profile-posts-grid'
import { ProjectCoverFallback } from '@/components/highlights/project-cover-fallback'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, getInitials } from '@/lib/utils'
import type { PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { ExploreTabs } from './explore-tabs'

export const metadata: Metadata = {
  title: 'Explorar',
  description: 'Veja projetos e publicações de missionários que usam o go→guide.',
}

// Página pública de descoberta (sem login) — pra onde o botão de voltar
// leva quando não há uma tela nossa de verdade pra voltar (ex.: link de
// projeto compartilhado aberto direto), em vez da landing de vendas.
// Só perfis com privacy_mode='public' aparecem aqui — quem escolheu
// private/stealth nunca é exposto fora do próprio perfil.
export default async function ExplorarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: publicProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('privacy_mode', 'public')
    .eq('user_role', 'missionary')

  const publicIds = (publicProfiles ?? []).map((p) => p.id)
  const visitorLocale = (await getLocale()) as Locale

  const [{ data: projects }, { data: posts }] = publicIds.length > 0
    ? await Promise.all([
        supabase.from('highlights')
          .select('id, slug, title, cover_url, cover_position, category, goal_amount, current_amount, currency, original_locale, title_translations, profile:profiles(id, username, display_name, avatar_url)')
          .in('profile_id', publicIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.from('posts')
          .select('*, profile:profiles(id, username, display_name, avatar_url, accent_color), highlight:highlights(title, slug, category, cover_url)')
          .in('profile_id', publicIds)
          .eq('is_draft', false)
          .order('published_at', { ascending: false })
          .limit(24),
      ])
    : [{ data: null }, { data: null }]

  const engagement = posts && posts.length > 0
    ? await enrichWithEngagement(supabase, posts.map((p) => p.id), user?.id)
    : new Map()
  const postsWithProfile = (posts ?? []).map((p) => ({
    ...p,
    ...engagement.get(p.id)!,
  })) as unknown as PostWithProfile[]

  const hasContent = (projects && projects.length > 0) || postsWithProfile.length > 0

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Explorar</h1>
          <p className="text-muted-foreground text-sm">Veja o que missionários estão fazendo agora pelo go→guide.</p>
        </div>

        {!hasContent && (
          <p className="text-sm text-muted-foreground italic">Ainda não há conteúdo público pra mostrar aqui.</p>
        )}

        {hasContent && (
          <ExploreTabs
            projects={
              projects && projects.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {projects.map((p) => {
                    const profile = p.profile as unknown as { id: string; username: string; display_name: string; avatar_url: string | null } | null
                    if (!profile) return null
                    const title = resolveLocalizedText(p.title, p.original_locale, p.title_translations, visitorLocale).text ?? p.title
                    const pct = p.goal_amount ? Math.min(100, (p.current_amount / p.goal_amount) * 100) : null
                    return (
                      <Link
                        key={p.id}
                        href={`/${profile.username}/projetos/${p.slug ?? p.id}`}
                        className="group space-y-2 rounded-xl border bg-card p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                          {p.cover_url ? (
                            <Image src={p.cover_url} alt={title} fill sizes="50vw" className="object-cover group-hover:scale-105 transition-transform" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
                          ) : (
                            <ProjectCoverFallback category={p.category} />
                          )}
                        </div>
                        <p className="text-sm font-medium line-clamp-2">{title}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar className="h-4 w-4 shrink-0">
                            <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
                            <AvatarFallback className="text-[8px]">{getInitials(profile.display_name)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{profile.display_name}</span>
                        </div>
                        {pct !== null && (
                          <div className="space-y-1">
                            <Progress value={pct} className="h-1.5" />
                            <p className="text-xs text-muted-foreground">{formatCurrency(p.current_amount, p.currency)} de {formatCurrency(p.goal_amount!, p.currency)}</p>
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-12">Nenhum projeto ativo no momento.</p>
              )
            }
            posts={
              postsWithProfile.length > 0
                ? <ProfilePostsGrid posts={postsWithProfile} visitorLocale={visitorLocale} />
                : <p className="text-center text-sm text-muted-foreground py-12">Nenhuma publicação ainda.</p>
            }
          />
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
