'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getInitials, formatRelativeTime, daysSince } from '@/lib/utils'
import { approveMissionary, rejectMissionary } from '@/app/dashboard/actions'
import {
  removeReportedPost, restoreReportedPost,
  removeReportedComment, restoreReportedComment,
  suspendAccount, restoreAccount,
} from '@/app/superadmin/actions'
import type { ReportReason } from '@/types/database'

export interface PendingMissionary {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  created_at: string
  verification_requested_at: string | null
}

export interface ReportedItem {
  id: string
  type: 'post' | 'comment'
  content: string | null
  media_url: string | null
  created_at: string
  postId?: string
  author: { id: string; username: string; display_name: string } | null
  reasons: ReportReason[]
}

export interface ReportedAccount {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
  account_status_changed_at: string
  reasons: ReportReason[]
}

interface Props {
  pendingMissionaries: PendingMissionary[]
  reportedContent: ReportedItem[]
  reportedAccounts: ReportedAccount[]
}

type Tab = 'verifications' | 'content' | 'accounts'

export function ModerationQueue({ pendingMissionaries, reportedContent, reportedAccounts }: Props) {
  const t = useTranslations('Superadmin')
  const tReason = useTranslations('Report')
  const [tab, setTab] = useState<Tab>('verifications')
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action()
        toast.success(successMessage)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('moderationActionError'))
      }
    })
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'verifications', label: t('tabVerifications'), count: pendingMissionaries.length },
    { id: 'content', label: t('tabContent'), count: reportedContent.length },
    { id: 'accounts', label: t('tabAccounts'), count: reportedAccounts.length },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold">{t('moderationTitle')}</h1>

        <div className="flex gap-1 border-b">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === tb.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tb.label} {tb.count > 0 && <span className="text-xs text-muted-foreground">({tb.count})</span>}
            </button>
          ))}
        </div>

        {tab === 'verifications' && (
          <div className="space-y-3">
            {pendingMissionaries.length === 0 && <EmptyState text={t('noPendingVerifications')} />}
            {pendingMissionaries.map((p) => (
              <div key={p.id} className="bg-card border rounded-2xl p-4 flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={p.avatar_url ?? ''} alt={p.display_name} />
                  <AvatarFallback>{getInitials(p.display_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link href={`/${p.username}`} target="_blank" className="text-sm font-medium hover:underline">
                    {p.display_name} <span className="text-muted-foreground font-normal">@{p.username}</span>
                  </Link>
                  {p.bio && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.bio}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('pendingSince', { days: daysSince(p.verification_requested_at ?? p.created_at) })}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" disabled={isPending} onClick={() => run(() => approveMissionary(p.id), t('approved'))}>
                      {t('approve')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => rejectMissionary(p.id), t('rejected'))}>
                      {t('reject')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'content' && (
          <div className="space-y-3">
            {reportedContent.length === 0 && <EmptyState text={t('noReportedContent')} />}
            {reportedContent.map((item) => (
              <div key={`${item.type}-${item.id}`} className="bg-card border rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase text-muted-foreground">{item.type === 'post' ? t('typePost') : t('typeComment')}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</span>
                </div>
                {item.author && (
                  <Link href={`/${item.author.username}`} target="_blank" className="text-sm font-medium hover:underline">
                    {item.author.display_name} <span className="text-muted-foreground font-normal">@{item.author.username}</span>
                  </Link>
                )}
                {item.content && <p className="text-sm whitespace-pre-wrap">{item.content}</p>}
                {item.media_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.media_url} alt="" className="max-h-48 rounded-lg object-cover" />
                )}
                <p className="text-xs text-muted-foreground">{t('reportReasons')}: {item.reasons.map((r) => tReason(`reason_${r}`)).join(', ') || '—'}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm" variant="destructive" disabled={isPending}
                    onClick={() => run(() => item.type === 'post' ? removeReportedPost(item.id) : removeReportedComment(item.id), t('removed'))}
                  >
                    {t('removeContent')}
                  </Button>
                  <Button
                    size="sm" variant="outline" disabled={isPending}
                    onClick={() => run(() => item.type === 'post' ? restoreReportedPost(item.id) : restoreReportedComment(item.id), t('restored'))}
                  >
                    {t('restoreContent')}
                  </Button>
                  {item.author && (
                    <Button
                      size="sm" variant="outline" disabled={isPending}
                      onClick={() => run(() => suspendAccount(item.author!.id), t('suspended'))}
                    >
                      {t('suspendAuthor')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="space-y-3">
            {reportedAccounts.length === 0 && <EmptyState text={t('noReportedAccounts')} />}
            {reportedAccounts.map((a) => (
              <div key={a.id} className="bg-card border rounded-2xl p-4 flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={a.avatar_url ?? ''} alt={a.display_name} />
                  <AvatarFallback>{getInitials(a.display_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link href={`/${a.username}`} target="_blank" className="text-sm font-medium hover:underline">
                    {a.display_name} <span className="text-muted-foreground font-normal">@{a.username}</span>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{t('reportReasons')}: {a.reasons.map((r) => tReason(`reason_${r}`)).join(', ') || '—'}</p>
                  <p className="text-xs text-muted-foreground">{t('pendingSince', { days: daysSince(a.account_status_changed_at) })}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="destructive" disabled={isPending} onClick={() => run(() => suspendAccount(a.id), t('suspended'))}>
                      {t('suspendDefinitely')}
                    </Button>
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => restoreAccount(a.id), t('restored'))}>
                      {t('restoreAccount')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>
}
