import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { E2EEGate } from '@/components/messages/e2ee-gate'
import { MessageThread } from '@/components/messages/message-thread'

interface Props { params: Promise<{ userId: string }> }

export default async function ConversaPage({ params }: Props) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getActiveProfile()
  if (!profile) notFound()

  // A conversa pode pertencer ao MEU perfil (alguém me mandando mensagem) ou ao perfil
  // de outro missionário (eu mandando mensagem pra ele como parceiro) — descobre pelo
  // histórico já trocado; sem histórico ainda, assume o meu próprio perfil.
  const { data: anyMessage } = await supabase
    .from('messages')
    .select('profile_id')
    .or(`and(sender_id.eq.${user!.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user!.id})`)
    .limit(1)
    .maybeSingle()
  const profileId = anyMessage?.profile_id ?? profile.id

  const { data: partner } = await supabase.from('partners').select('name').eq('profile_id', profile.id).eq('user_id', userId).maybeSingle()
  const { data: senderProfile } = await supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
  const otherName = partner?.name ?? senderProfile?.display_name ?? 'Conversa'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{otherName}</h1>
      <E2EEGate userId={user!.id}>
        <MessageThread profileId={profileId} myUserId={user!.id} otherUserId={userId} otherName={otherName} />
      </E2EEGate>
    </div>
  )
}
