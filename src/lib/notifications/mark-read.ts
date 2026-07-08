import { createClient } from '@/lib/supabase/server'
import { NotificationType } from '@/types/database'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function markNotificationTypesRead(
  supabase: SupabaseServerClient,
  userId: string,
  types: NotificationType[]
) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .is('read_at', null)
    .in('type', types)
}

export async function markMessageNotificationsRead(
  supabase: SupabaseServerClient,
  userId: string,
  senderId: string
) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .eq('type', 'new_message')
    .eq('payload->>sender_id', senderId)
    .is('read_at', null)
}
