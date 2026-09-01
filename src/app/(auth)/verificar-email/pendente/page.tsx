'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSignOut } from '@/hooks/use-dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, MailCheck } from 'lucide-react'

const RESEND_COOLDOWN_MS = 30_000

export default function VerificarEmailPendentePage() {
  const t = useTranslations('Auth')
  const tNav = useTranslations('DashboardNav')
  const handleSignOut = useSignOut()
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  async function handleResend() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/enviar-verificacao', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.success(t('verifyEmailResendSuccess'))
        setCooldown(true)
        setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS)
      } else {
        toast.error(t('verifyEmailResendError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MailCheck className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-2xl">{t('verifyEmailPendingTitle')}</CardTitle>
        <CardDescription>{t('verifyEmailPendingBody')}</CardDescription>
      </CardHeader>

      <CardContent>
        <Button className="w-full" onClick={handleResend} disabled={loading || cooldown}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('verifyEmailResend')}
        </Button>
      </CardContent>

      <CardFooter className="justify-center">
        <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:underline">
          {tNav('signOut')}
        </button>
      </CardFooter>
    </Card>
  )
}
