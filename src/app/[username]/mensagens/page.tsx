import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { E2EEGate } from '@/components/messages/e2ee-gate'
import { MessageThread } from '@/components/messages/message-thread'
import Link from 'next/link'

interface Props { params: Promise<{ username: string }> }

export default async function PartnerMensagensPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/${username}/mensagens`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, display_name, privacy_mode')
    .eq('username', username)
    .single()
  if (!profile || profile.privacy_mode === 'stealth') notFound()

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Conversa com {profile.display_name}</h1>
        <E2EEGate userId={user.id}>
          <MessageThread profileId={profile.id} myUserId={user.id} otherUserId={profile.user_id} otherName={profile.display_name} />
        </E2EEGate>
        <p className="text-center">
          <Link href="/conta/excluir" className="text-xs text-muted-foreground hover:underline">Excluir minha conta e dados</Link>
        </p>
      </div>
    </div>
  )
}
