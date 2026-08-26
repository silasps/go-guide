'use client'

import Link from 'next/link'
import { useProfileTab } from './profile-tab-context'
import type { Tab } from './profile-content-tabs'

interface StatProps {
  value: number
  label: string
}

/** "posts"/"projetos" trocam a aba inline e rolam até ela, sem navegar —
 *  "conquistas" é conteúdo de outra página (trajetória), então continua Link normal. */
export function ProfileStats({
  postsCount, postsLabel,
  projectsCount, projectsLabel,
  achievementsCount, achievementsLabel,
  username,
}: {
  postsCount: number; postsLabel: string
  projectsCount: number; projectsLabel: string
  achievementsCount: number; achievementsLabel: string
  username: string
}) {
  const { setTab } = useProfileTab()

  function goToTab(tab: Tab) {
    setTab(tab)
    document.getElementById('conteudo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex-1 grid grid-cols-3 text-center">
      <StatButton value={postsCount} label={postsLabel} onClick={() => goToTab('posts')} />
      <StatButton value={projectsCount} label={projectsLabel} onClick={() => goToTab('projects')} />
      <Link href={`/${username}/trajetoria`} className="hover:opacity-70 transition-opacity">
        <Stat value={achievementsCount} label={achievementsLabel} />
      </Link>
    </div>
  )
}

function StatButton({ value, label, onClick }: StatProps & { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hover:opacity-70 transition-opacity">
      <Stat value={value} label={label} />
    </button>
  )
}

function Stat({ value, label }: StatProps) {
  return (
    <div>
      <div className="text-base font-semibold leading-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
