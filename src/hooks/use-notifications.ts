'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Notification } from '@/types/database'

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  async function markAllRead() {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', userId)
      .is('read_at', null)
    setNotifications([])
    setUnread(0)
  }

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void Promise.resolve().then(async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!cancelled && data) {
        setNotifications(data)
        setUnread(data.length)
      }
    })

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
          setUnread(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { notifications, unread, markAllRead }
}
