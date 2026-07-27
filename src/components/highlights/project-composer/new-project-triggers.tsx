'use client'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { useProjectComposer } from './project-composer-provider'
import { Plus, FolderOpen } from 'lucide-react'

export function NewProjectQuickAction({ label, description }: { label: string; description: string }) {
  const { openProjectComposer } = useProjectComposer()
  return (
    <button
      onClick={openProjectComposer}
      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group w-full text-left"
    >
      <div className="p-1.5 bg-muted rounded-md shrink-0 group-hover:bg-background transition-colors">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  )
}

export function NewProjectButton({ label, className }: { label: string; className?: string }) {
  const { openProjectComposer } = useProjectComposer()
  return (
    <button onClick={openProjectComposer} className={cn(buttonVariants(), 'gap-2', className)}>
      <Plus className="h-4 w-4" />
      {label}
    </button>
  )
}
