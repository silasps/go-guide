import { createClient } from '@/lib/supabase/server'
import { ConversationList } from '@/components/messages/conversation-list'

export default async function MensagensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()

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

  const conversations = [...seen.entries()].map(([otherUserId, lastMessageAt]) => ({
    otherUserId,
    name: nameByUserId.get(otherUserId) ?? 'Parceiro',
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
