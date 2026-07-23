'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getLinkableProjects } from '@/app/dashboard/publicacoes/actions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FolderOpen, X, Loader2 } from 'lucide-react'

type LinkableProject = { id: string; title: string; slug: string | null; cover_url: string | null }

interface Props {
  profileId: string
  value: string | null
  onChange: (id: string | null) => void
}

export function PostEditorProjectPicker({ profileId, value, onChange }: Props) {
  const t = useTranslations('PostComposer')
  const [projects, setProjects] = useState<LinkableProject[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function ensureLoaded() {
    if (projects !== null || loading) return
    setLoading(true)
    try {
      const data = await getLinkableProjects(profileId)
      setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  const selected = projects?.find((p) => p.id === value) ?? null

  if (projects !== null && projects.length === 0 && !value) return null

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 w-fit">
        <div className="h-5 w-5 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
          {selected.cover_url ? (
            <Image src={selected.cover_url} alt="" width={20} height={20} className="h-full w-full object-cover" />
          ) : (
            <FolderOpen className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <span className="text-xs font-medium truncate max-w-40">{selected.title}</span>
        <button type="button" onClick={() => onChange(null)} aria-label={t('clearProject')}>
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 w-fit')}
        onClick={ensureLoaded}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
        {t('linkProject')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {projects?.map((project) => (
          <DropdownMenuItem key={project.id} onClick={() => onChange(project.id)} className="gap-2">
            <div className="h-5 w-5 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
              {project.cover_url ? (
                <Image src={project.cover_url} alt="" width={20} height={20} className="h-full w-full object-cover" />
              ) : (
                <FolderOpen className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <span className="truncate">{project.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
