'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import * as keyManager from '@/lib/crypto/key-manager'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordRequirementsList } from '@/components/auth/password-requirements-list'
import { isPasswordValid } from '@/lib/auth/password-requirements'
import { isAuthWeakPasswordError } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'

export default function NovaSenhaPage() {
  const t = useTranslations('Auth')
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [hasE2eeKeys, setHasE2eeKeys] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { isPending: loading, run } = usePendingAction()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setValidSession(!!session)
      // A chave privada antiga (mensagens, dados sensíveis) só é decifrável com a
      // senha antiga — trocar a senha aqui a torna irrecuperável (ver
      // system.architecture.md 7.5). Só vale avisar quem já tem chave configurada.
      if (session) setHasE2eeKeys(await keyManager.hasKeysConfigured(session.user.id))
      setChecking(false)
    })
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isPasswordValid(password)) {
      toast.error(t('passwordRequirementsError'))
      return
    }
    if (password !== confirmPassword) {
      toast.error(t('passwordsDontMatch'))
      return
    }

    run(true, async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error(isAuthWeakPasswordError(error) && error.reasons.includes('pwned') ? t('passwordPwnedError') : error.message)
        return
      }

      toast.success(t('passwordUpdated'))
      router.push('/dashboard')
      router.refresh()
    })
  }

  if (checking) {
    return <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">{t('loading')}</div>
  }

  if (!validSession) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('resetLinkInvalidTitle')}</CardTitle>
          <CardDescription>{t('resetLinkInvalidSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/recuperar-senha" className="text-sm text-primary hover:underline font-medium">
            {t('requestNewLink')}
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('newPasswordTitle')}</CardTitle>
        <CardDescription>{t('newPasswordSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        {hasE2eeKeys && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{t('resetE2eeWarning')}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('newPassword')}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <PasswordRequirementsList password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !isPasswordValid(password)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('newPasswordSubmit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
