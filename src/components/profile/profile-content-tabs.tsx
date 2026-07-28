'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Grid3x3, FolderOpen, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PostWithProfile, Highlight } from '@/types/database'
import type { HistoryBlock } from '@/types/history'
import type { Locale } from '@/i18n/config'
import { ProfilePostsGrid } from '@/components/shared/profile-posts-grid'
import { ProjectsGrid } from '@/components/profile/projects-grid'
import { HistoryView } from '@/components/profile/history-view'

type Tab = 'posts' | 'projects' | 'history'

interface Props {
  posts: PostWithProfile[]
  projects: Highlight[]
  historyBlocks: HistoryBlock[]
  username: string
  accentColor: string
  visitorLocale: Locale
  showProjects: boolean
  showHistory: boolean
}

/** Seletor inline estilo Instagram (só ícones) que troca o conteúdo abaixo
 *  sem navegar — as bolinhas de destaque dos projetos continuam existindo
 *  acima disso, como outro ponto de acesso; este seletor é sobre o que
 *  aparece na "grade" principal do perfil. */
export function ProfileContentTabs({ posts, projects, historyBlocks, username, accentColor, visitorLocale, showProjects, showHistory }: Props) {
  const t = useTranslations('PublicProfile')
  const [tab, setTab] = useState<Tab>('posts')

  const tabs = [
    { id: 'posts' as const, Icon: Grid3x3 },
    ...(showProjects ? [{ id: 'projects' as const, Icon: FolderOpen }] : []),
    ...(showHistory ? [{ id: 'history' as const, Icon: BookOpen }] : []),
  ]

  if (tabs.length <= 1) {
    return posts.length ? <ProfilePostsGrid posts={posts} visitorLocale={visitorLocale} /> : null
  }

  return (
    <div className="space-y-3">
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

      {tab === 'posts' && (posts.length ? <ProfilePostsGrid posts={posts} visitorLocale={visitorLocale} /> : <EmptyState label={t('noContentYet')} />)}
      {tab === 'projects' && (projects.length ? <ProjectsGrid projects={projects} username={username} accentColor={accentColor} /> : <EmptyState label={t('noContentYet')} />)}
      {tab === 'history' && (historyBlocks.length ? <HistoryView blocks={historyBlocks} /> : <EmptyState label={t('noContentYet')} />)}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-center text-sm text-muted-foreground py-12">{label}</p>
}
