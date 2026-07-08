'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Profile, ProfileManager, ProfileManagerRole } from '@/types/database'
import { planLimits } from '@/lib/utils'
import { MANAGER_ADDONS } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'

interface Props {
  profile: Profile
  managers: ProfileManager[]
}

export function AccessManagersForm({ profile, managers: initialManagers }: Props) {
  const t = useTranslations('AccessManagersForm')
  const [managers, setManagers] = useState(initialManagers)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProfileManagerRole>('manager')
  const [inviting, setInviting] = useState(false)
  const [buyingSeats, setBuyingSeats] = useState<number | null>(null)

  async function handleBuyAddon(seats: number) {
    setBuyingSeats(seats)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manager_addon', seats }),
      })
      if (!res.ok) {
        toast.info(t('paymentsNotConfigured'))
        return
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setBuyingSeats(null)
    }
  }

  const included = planLimits(profile.plan).managersIncluded
  const total = included + profile.extra_manager_seats
  const used = managers.length
  const atLimit = total !== Infinity && used >= total

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('invite_profile_manager', {
      p_profile_id: profile.id,
      p_email: email.trim(),
      p_role: role,
    })

    if (error) {
      if (error.message.includes('seat_limit_reached')) {
        toast.error(t('seatLimitReached'))
      } else if (error.message.includes('user_not_found')) {
        toast.error(t('userNotFound'))
      } else {
        toast.error(t('errorInvite'))
      }
      setInviting(false)
      return
    }

    const { data } = await supabase.from('profile_managers').select('*').eq('profile_id', profile.id)
    setManagers(data ?? [])
    setEmail('')
    setInviting(false)
    toast.success(t('managerAdded'))
  }

  async function handleRemove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('profile_managers').delete().eq('id', id)
    if (error) {
      toast.error(t('errorRemove'))
      return
    }
    setManagers(managers.filter((m) => m.id !== id))
    toast.success(t('removed'))
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">
          {t('usedCount', { used, total: total === Infinity ? '∞' : total })}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('accessDescription')}
        </p>
      </div>

      <div className="space-y-2">
        {managers.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('userLabel', { id: m.user_id.slice(0, 8) })}</p>
              <p className="text-xs text-muted-foreground">{m.role === 'manager' ? t('manager') : t('viewer')}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(m.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {managers.length === 0 && <p className="text-sm text-muted-foreground">{t('noManagers')}</p>}
      </div>

      <div className="space-y-3 border-t pt-4">
        <Label htmlFor="manager_email">{t('inviteByEmail')}</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="manager_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProfileManagerRole)}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="manager">{t('manager')}</option>
            <option value="viewer">{t('viewer')}</option>
          </select>
          <Button onClick={handleInvite} disabled={inviting || atLimit}>
            {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('invite')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('inviteHint')}</p>
      </div>

      {atLimit && (
        <div className="space-y-2 border-t pt-4">
          <Label>{t('buyMoreSeats')}</Label>
          {MANAGER_ADDONS.map((addon) => (
            <div key={addon.seats} className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm">{t('addonLine', { seats: addon.seats, price: addon.priceMonthly })}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={buyingSeats === addon.seats}
                onClick={() => handleBuyAddon(addon.seats)}
              >
                {buyingSeats === addon.seats && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('buy')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
