import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { ConversationList } from '@/components/messages/conversation-list'

export default async function MensagensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getActiveProfile()

  const { data: messages } = await supabase
    .from('messages')
    .select('sender_id, recipient_id, created_at')
    .eq('profile_id', profile!.id)
    .order('created_at', { ascending: false })

  const { data: partners } = await supabase.from('partners').select('user_id, name').eq('profile_id', profile!.id).not('user_id', 'is', null)
  const nameByUserId = new Map((partners ?? []).map(p => [p.user_id as string, p.name]))

  const seen = new Map<string, string>()
  for (const m of messages ?? []) {
    const otherId = m.sender_id === user!.id ? m.recipient_id : m.sender_id
    if (!seen.has(otherId)) seen.set(otherId, m.created_at)
  }

  const otherUserIds = [...seen.keys()]
  const { data: senderProfiles } = otherUserIds.length
    ? await supabase.from('profiles').select('user_id, display_name').in('user_id', otherUserIds)
    : { data: [] }
  const displayNameByUserId = new Map((senderProfiles ?? []).map(p => [p.user_id as string, p.display_name]))

  const conversations = [...seen.entries()].map(([otherUserId, lastMessageAt]) => ({
    otherUserId,
    name: nameByUserId.get(otherUserId) ?? displayNameByUserId.get(otherUserId) ?? 'Parceiro',
    lastMessageAt,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mensagens</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Conversas cifradas com seus parceiros</p>
      </div>
      <ConversationList conversations={conversations} basePath="/dashboard/mensagens" />
    </div>
  )
}
