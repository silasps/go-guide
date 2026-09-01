'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, MailCheck } from 'lucide-react'

const RESEND_COOLDOWN_MS = 30_000

// Banner persistente (não modal, não bloqueia nada) mostrado no topo de
// qualquer página do dashboard enquanto profile.email_verified for false —
// a pedido do usuário: "o usuário não perde acesso ao sistema, mas essa
// pendência fica aparecendo sempre pra pessoa até ela verificar o e-mail".
// Some sozinho assim que o link de confirmação é clicado (sem lógica de
// dismiss — reaparece em toda visita até resolver de verdade).
export function EmailVerificationBanner() {
  const t = useTranslations('Auth')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  async function handleResend() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/enviar-verificacao', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.success(t('verifyEmailResendSuccess', { email: data.email }))
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
    <div className="mb-4 rounded-2xl border bg-card p-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <MailCheck className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{t('verifyEmailPendingTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('verifyEmailPendingBody')}</p>
      </div>
      <Button size="sm" onClick={handleResend} disabled={loading || cooldown} className="shrink-0">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('verifyEmailResend')}
      </Button>
    </div>
  )
}
