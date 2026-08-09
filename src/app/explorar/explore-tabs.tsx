'use client'

import { useState } from 'react'
import { FolderOpen, Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  projects: React.ReactNode
  posts: React.ReactNode
}

const TABS = [
  { id: 'projects' as const, Icon: FolderOpen, label: 'Projetos' },
  { id: 'posts' as const, Icon: Grid3x3, label: 'Publicações' },
]

// Mesmo padrão do `ProfileContentTabs` do perfil (seletor estilo
// Instagram) — projetos e publicações ficam no mesmo nível, lado a lado,
// em vez de um bloco sempre em cima do outro; a pessoa escolhe o que ver
// primeiro em vez de rolar por uma ordem fixa.
export function ExploreTabs({ projects, posts }: Props) {
  const [tab, setTab] = useState<'projects' | 'posts'>('projects')

  return (
    <div className="space-y-4">
      <div className="flex border-y -mx-4">
        {TABS.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 border-t-2 -mt-px text-sm font-medium transition-colors',
              tab === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'projects' ? projects : posts}
    </div>
  )
}
