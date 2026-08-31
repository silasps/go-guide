'use client'

import { useTranslations } from 'next-intl'
import { Grid3x3, FolderOpen, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PostWithProfile, Highlight } from '@/types/database'
import type { HistoryBlock } from '@/types/history'
import type { Locale } from '@/i18n/config'
import { ProfilePostsGrid } from '@/components/shared/profile-posts-grid'
import { ProjectsGrid } from '@/components/profile/projects-grid'
import { HistoryView } from '@/components/profile/history-view'
import { useProfileTab } from './profile-tab-context'

export type Tab = 'posts' | 'projects' | 'history'

interface Props {
  posts: PostWithProfile[]
  projects: Highlight[]
  historyBlocks: HistoryBlock[]
  username: string
  accentColor: string
  visitorLocale: Locale
  showProjects: boolean
  showHistory: boolean
  canEdit: boolean
  deepLinkPostId?: string
  deepLinkComments?: boolean
}

/** Seletor inline estilo Instagram (só ícones) que troca o conteúdo abaixo
 *  sem navegar — as bolinhas de destaque dos projetos continuam existindo
 *  acima disso, como outro ponto de acesso; este seletor é sobre o que
 *  aparece na "grade" principal do perfil. */
export function ProfileContentTabs({ posts, projects, historyBlocks, username, accentColor, visitorLocale, showProjects, showHistory, canEdit, deepLinkPostId, deepLinkComments }: Props) {
  const t = useTranslations('PublicProfile')
  const { tab, setTab } = useProfileTab()

  const tabs = [
    { id: 'posts' as const, Icon: Grid3x3 },
    ...(showProjects ? [{ id: 'projects' as const, Icon: FolderOpen }] : []),
    ...(showHistory ? [{ id: 'history' as const, Icon: BookOpen }] : []),
  ]

  if (tabs.length <= 1) {
    return posts.length ? (
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('postsHeading')}</h2>
        <ProfilePostsGrid posts={posts} visitorLocale={visitorLocale} canEdit={canEdit} deepLinkPostId={deepLinkPostId} deepLinkComments={deepLinkComments} />
      </div>
    ) : null
  }

  const headingKey = tab === 'posts' ? 'postsHeading' : tab === 'projects' ? 'projectsHeading' : null

  return (
    <div className="space-y-3">
      {headingKey && <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t(headingKey)}</h2>}
      <div className="flex border-y -mx-4">
        {tabs.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center py-2.5 border-t-2 -mt-px transition-colors',
              tab === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>

      {tab === 'posts' && (posts.length ? (
        <ProfilePostsGrid posts={posts} visitorLocale={visitorLocale} canEdit={canEdit} deepLinkPostId={deepLinkPostId} deepLinkComments={deepLinkComments} />
      ) : <EmptyState label={t('noContentYet')} />)}
      {tab === 'projects' && (projects.length ? <ProjectsGrid projects={projects} username={username} accentColor={accentColor} visitorLocale={visitorLocale} /> : <EmptyState label={t('noContentYet')} />)}
      {tab === 'history' && (historyBlocks.length ? <HistoryView blocks={historyBlocks} visitorLocale={visitorLocale} /> : <EmptyState label={t('noContentYet')} />)}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-center text-sm text-muted-foreground py-12">{label}</p>
}
