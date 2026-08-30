'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getInitials, formatRelativeTime, cn } from '@/lib/utils'
import { toggleAccountStatus } from '@/app/dashboard/actions'
import type { AccountStatus, Gender, PrivacyMode, UserRole, VerificationStatus } from '@/types/database'

export interface AdminUserRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  user_role: UserRole
  gender: Gender
  privacy_mode: PrivacyMode
  verification_status: VerificationStatus
  account_status: AccountStatus
  created_at: string
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <span className={cn(
      'text-[11px] px-1.5 py-0.5 rounded-md font-medium',
      tone === 'default' && 'bg-muted text-muted-foreground',
      tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
      tone === 'danger' && 'bg-destructive/10 text-destructive'
    )}>
      {children}
    </span>
  )
}

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const t = useTranslations('Superadmin')
  const tRole = useTranslations('DashboardNav')
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [localUsers, setLocalUsers] = useState(users)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return localUsers
    return localUsers.filter((u) => u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
  }, [localUsers, query])

  function handleToggle(user: AdminUserRow) {
    const next = user.account_status === 'suspended' ? 'active' : 'suspended'
    startTransition(async () => {
      try {
        await toggleAccountStatus(user.id, next)
        setLocalUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, account_status: next } : u)))
        toast.success(next === 'suspended' ? t('suspended') : t('restored'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('moderationActionError'))
      }
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('usersTitle')}</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchUsers')} className="pl-9" />
      </div>

      <p className="text-xs text-muted-foreground">{t('usersCount', { count: filtered.length })}</p>

      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="bg-card border rounded-2xl p-3 flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={u.avatar_url ?? ''} alt={u.display_name} />
              <AvatarFallback>{getInitials(u.display_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <Link href={`/${u.username}`} target="_blank" className="text-sm font-medium hover:underline">
                {u.display_name} <span className="text-muted-foreground font-normal">@{u.username}</span>
              </Link>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{u.user_role === 'missionary' ? tRole('roleBadgeMissionary') : tRole('roleBadgePartner')}</Badge>
                {u.gender !== 'unspecified' && <Badge>{u.gender === 'male' ? t('genderMale') : t('genderFemale')}</Badge>}
                <Badge>{t(`privacy_${u.privacy_mode}`)}</Badge>
                {u.verification_status !== 'approved' && (
                  <Badge tone={u.verification_status === 'pending' ? 'warning' : 'danger'}>{t(`verification_${u.verification_status}`)}</Badge>
                )}
                {u.account_status !== 'active' && (
                  <Badge tone={u.account_status === 'suspended' ? 'danger' : 'warning'}>{t(`accountStatus_${u.account_status}`)}</Badge>
                )}
                <span className="text-[11px] text-muted-foreground">{formatRelativeTime(u.created_at)}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant={u.account_status === 'suspended' ? 'outline' : 'destructive'}
              disabled={isPending}
              onClick={() => handleToggle(u)}
              className="shrink-0"
            >
              {u.account_status === 'suspended' ? t('reactivate') : t('suspendAuthor')}
            </Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('noUsersFound')}</p>}
      </div>
    </div>
  )
}
