'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useNotifications } from '@/hooks/use-notifications'
import { cn, formatRelativeTime } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Bell, FileText, Heart, Users, MessageSquare, Wallet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NotificationArea = 'messages' | 'prayers' | 'partners' | 'financial' | 'content'

const AREA_ORDER: NotificationArea[] = ['messages', 'prayers', 'partners', 'financial', 'content']

const AREA_BY_TYPE: Record<string, NotificationArea> = {
  new_message: 'messages',
  new_prayer_request: 'prayers',
  prayer_reply: 'prayers',
  prayer_answered: 'prayers',
  new_partner: 'partners',
  new_pledge: 'financial',
  pledge_confirmed: 'financial',
  new_post: 'content',
  highlight_update: 'content',
}

const AREA_HREF: Record<NotificationArea, string> = {
  messages: '/dashboard/mensagens',
  prayers: '/dashboard/oracoes',
  partners: '/dashboard/parceiros',
  financial: '/dashboard/financeiro/lancamentos',
  content: '/dashboard/publicacoes',
}

const AREA_ICON: Record<NotificationArea, React.ComponentType<{ className?: string }>> = {
  messages: MessageSquare,
  prayers: Heart,
  partners: Users,
  financial: Wallet,
  content: FileText,
}

const AREA_LABEL_KEY: Record<NotificationArea, 'areaMessages' | 'areaPrayers' | 'areaPartners' | 'areaFinancial' | 'areaContent'> = {
  messages: 'areaMessages',
  prayers: 'areaPrayers',
  partners: 'areaPartners',
  financial: 'areaFinancial',
  content: 'areaContent',
}

interface AreaGroup {
  area: NotificationArea
  ids: string[]
  count: number
  latest: string
}

function groupByArea(notifications: { id: string; type: string; created_at: string }[]): AreaGroup[] {
  const groups = new Map<NotificationArea, AreaGroup>()
  for (const n of notifications) {
    const area = AREA_BY_TYPE[n.type] ?? 'content'
    const g = groups.get(area)
    if (g) {
      g.ids.push(n.id)
      g.count += 1
      if (n.created_at > g.latest) g.latest = n.created_at
    } else {
      groups.set(area, { area, ids: [n.id], count: 1, latest: n.created_at })
    }
  }
  return AREA_ORDER.filter(area => groups.has(area)).map(area => groups.get(area)!)
}

export function NotificationsBell({ userId }: { userId: string }) {
  const t = useTranslations('Notifications')
  const { notifications, unread, markAllRead, markManyRead } = useNotifications(userId)
  const groups = groupByArea(notifications)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('ariaOpen')}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative h-8 w-8')}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">{t('title')}</DropdownMenuLabel>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              {t('markAllRead')}
            </button>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {groups.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
        )}
        {groups.map(g => {
          const Icon = AREA_ICON[g.area]
          return (
            <DropdownMenuItem
              key={g.area}
              onClick={() => markManyRead(g.ids)}
              className="py-0"
              render={<Link href={AREA_HREF[g.area]} className="flex items-start gap-2.5 py-3" />}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{t(AREA_LABEL_KEY[g.area], { count: g.count })}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(g.latest)}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
