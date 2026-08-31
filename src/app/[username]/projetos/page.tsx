import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getProfileOrRedirect } from '@/lib/profile/get-profile'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import type { Locale } from '@/i18n/config'
import { CheckCircle2, Plus, Archive } from 'lucide-react'
import { ProjectGrid } from '@/components/highlights/project-grid'

interface Props { params: Promise<{ username: string }> }

export default async function ProjetosPublicosPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfileOrRedirect(username, '/projetos')

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const visitorLocale = (await getLocale()) as Locale
  const supabase = await createClient()
  const t = await getTranslations('PublicProfile')
  const [{ data: projects }, { canEdit }] = await Promise.all([
    supabase
      .from('highlights')
      .select('*')
      .eq('profile_id', profile.id)
      .neq('status', 'hidden')
      .is('archived_at', null)
      .order('order_index'),
    getProfileViewerContext(username),
  ])

  const active = projects?.filter(p => p.status === 'active') ?? []
  const completed = projects?.filter(p => p.status === 'completed') ?? []

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Projetos</h1>
            <p className="text-muted-foreground text-sm mt-1">Veja tudo o que {profile.display_name} está construindo e o que já foi realizado.</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/dashboard/projetos/arquivados"
                className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'shrink-0')}
                aria-label="Projetos arquivados"
                title="Projetos arquivados"
              >
                <Archive className="h-3.5 w-3.5" />
              </Link>
              <Link href="/dashboard/projetos/novo" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 shrink-0')}>
                <Plus className="h-3.5 w-3.5" />
                {t('createProject')}
              </Link>
            </div>
          )}
        </div>

        {/* Projetos ativos */}
        {active.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Em andamento</h2>
            <ProjectGrid projects={active} username={username} accentColor={profile.accent_color} visitorLocale={visitorLocale} canEdit={canEdit} />
          </section>
        )}

        {/* Projetos concluídos */}
        {completed.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Concluídos
            </h2>
            <ProjectGrid projects={completed} username={username} accentColor={profile.accent_color} visitorLocale={visitorLocale} canEdit={canEdit} completed />
          </section>
        )}

        {!projects?.length && (
          <p className="text-center text-muted-foreground py-12">Nenhum projeto publicado ainda.</p>
        )}
      </div>
    </div>
  )
}
