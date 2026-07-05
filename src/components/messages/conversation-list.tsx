import Link from 'next/link'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface ConversationItem {
  otherUserId: string
  name: string
  lastMessageAt: string
}

export function ConversationList({ conversations, basePath }: { conversations: ConversationItem[]; basePath: string }) {
  if (conversations.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma conversa ainda.</p>
  }

  return (
    <div className="space-y-1.5">
      {conversations.map(c => (
        <Link
          key={c.otherUserId}
          href={`${basePath}/${c.otherUserId}`}
          className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-xs">{getInitials(c.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">🔒 Conversa cifrada</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>
        </Link>
      ))}
    </div>
  )
}
