'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { UserRole } from '@/types/database'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Plus, FileText, FolderOpen } from 'lucide-react'

interface Props {
  role: UserRole
}

// FAB estilo X/Twitter — parceiros não criam post/projeto, só missionários.
export function CreateContentFab({ role }: Props) {
  const t = useTranslations('CreateContent')
  if (role === 'partner') return null

  return (
    <div className="md:hidden fixed bottom-20 right-4 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('ariaLabel')}
          className="h-14 w-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48">
          <DropdownMenuItem render={<Link href="/dashboard/publicacoes/nova" />} className="gap-2">
            <FileText className="h-4 w-4" />
            {t('newPost')}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/projetos/novo" />} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            {t('newProject')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
