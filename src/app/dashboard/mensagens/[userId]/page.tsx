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

  const { data: partner } = await supabase.from('partners').select('name').eq('profile_id', profile.id).eq('user_id', userId).maybeSingle()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{partner?.name ?? 'Conversa'}</h1>
      <E2EEGate userId={user!.id}>
        <MessageThread profileId={profile.id} myUserId={user!.id} otherUserId={userId} otherName={partner?.name ?? 'Parceiro'} />
      </E2EEGate>
    </div>
  )
}
