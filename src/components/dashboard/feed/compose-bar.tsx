'use client'

import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useComposer } from '@/components/dashboard/post-composer-provider'
import { getInitials } from '@/lib/utils'

interface Props {
  displayName: string
  avatarUrl: string | null
}

export function ComposeBar({ displayName, avatarUrl }: Props) {
  const t = useTranslations('Feed')
  const { openComposer } = useComposer()

  return (
    <button
      onClick={() => openComposer()}
      className="flex items-center gap-3 w-full p-3 rounded-2xl border bg-card hover:bg-muted/50 transition-colors text-left"
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={avatarUrl ?? ''} alt={displayName} />
        <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">{t('composePlaceholder')}</span>
    </button>
  )
}
