'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile
}

export function PaymentForm({ profile }: Props) {
  const t = useTranslations('PaymentForm')
  const router = useRouter()
  const [pixKey, setPixKey] = useState(profile.pix_key ?? '')
  const [paypalUrl, setPaypalUrl] = useState(profile.paypal_url ?? '')
  const [wiseUrl, setWiseUrl] = useState(profile.wise_url ?? '')
  const [donationUrl, setDonationUrl] = useState(profile.external_donation_url ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        pix_key: pixKey || null,
        paypal_url: paypalUrl || null,
        wise_url: wiseUrl || null,
        external_donation_url: donationUrl || null,
      })
      .eq('id', profile.id)

    if (error) toast.error(t('errorSave'))
    else { toast.success(t('updated')); router.refresh() }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      <div className="space-y-4">
        {[
          { id: 'pix', label: t('pixLabel'), value: pixKey, set: setPixKey, placeholder: t('pixPlaceholder') },
          { id: 'paypal', label: 'PayPal', value: paypalUrl, set: setPaypalUrl, placeholder: t('paypalPlaceholder') },
          { id: 'wise', label: 'Wise', value: wiseUrl, set: setWiseUrl, placeholder: t('wisePlaceholder') },
          { id: 'donation', label: t('donationLabel'), value: donationUrl, set: setDonationUrl, placeholder: 'https://...' },
        ].map(({ id, label, value, set, placeholder }) => (
          <div key={id} className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('save')}
      </Button>
    </div>
  )
}
