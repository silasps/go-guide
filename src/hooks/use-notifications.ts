'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Notification } from '@/types/database'

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unread = notifications.length

  async function markAllRead() {
    setNotifications([])
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', userId)
      .is('read_at', null)
  }

  async function markManyRead(ids: string[]) {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    setNotifications(prev => prev.filter(n => !idSet.has(n.id)))
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
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
      }
    })

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Notification
          if (updated.read_at) {
            setNotifications(prev => prev.filter(n => n.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { notifications, unread, markAllRead, markManyRead }
}
