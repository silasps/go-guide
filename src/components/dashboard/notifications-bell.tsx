'use client'

import { useTranslations } from 'next-intl'
import { useNotifications } from '@/hooks/use-notifications'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Bell, FileText, Heart, Users, MessageSquare, Wallet, HandCoins } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new_post: FileText,
  new_prayer_request: Heart,
  new_partner: Users,
  new_message: MessageSquare,
  prayer_answered: Heart,
  prayer_reply: Heart,
  new_pledge: HandCoins,
  pledge_confirmed: Wallet,
  highlight_update: FileText,
}

function formatMessage(t: ReturnType<typeof useTranslations<'Notifications'>>, type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'new_pledge':
      return t('newPledge', { name: (payload.reporter_name as string) ?? t('someone'), amount: formatCurrency(Number(payload.amount ?? 0), 'BRL') })
    case 'pledge_confirmed':
      return payload.highlight_title
        ? t('pledgeConfirmedWithTitle', { amount: formatCurrency(Number(payload.amount ?? 0), 'BRL'), title: payload.highlight_title as string })
        : t('pledgeConfirmed', { amount: formatCurrency(Number(payload.amount ?? 0), 'BRL') })
    case 'new_partner':
      return t('newPartner', { name: (payload.name as string) ?? t('someone') })
    case 'new_message':
      return t('newMessage')
    case 'prayer_reply':
      return t('prayerReply')
    case 'highlight_update':
      return t('highlightUpdate')
    default:
      return (payload.message as string) ?? type
  }
}

export function NotificationsBell({ userId }: { userId: string }) {
  const t = useTranslations('Notifications')
  const { notifications, unread, markAllRead } = useNotifications(userId)

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
        {notifications.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
        )}
        {notifications.map(n => {
          const Icon = ICONS[n.type] ?? Bell
          const payload = n.payload as Record<string, unknown>
          return (
            <DropdownMenuItem key={n.id} className="flex items-start gap-2.5 py-3 cursor-default">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{formatMessage(t, n.type, payload)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(n.created_at)}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
