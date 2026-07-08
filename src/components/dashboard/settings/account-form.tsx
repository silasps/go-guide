'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config'

const LOCALE_LABELS: Record<Locale, string> = { pt: '🇧🇷 Português', en: '🇺🇸 English', es: '🇪🇸 Español' }

interface Props {
  profile: Profile
}

export function AccountForm({ profile }: Props) {
  const t = useTranslations('AccountForm')
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(profile.locale)
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleLocaleChange(next: Locale) {
    if (next === locale || pendingLocale) return
    setPendingLocale(next)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ locale: next }).eq('id', profile.id)
    if (error) {
      toast.error(t('errorSaveLocale'))
      setPendingLocale(null)
      return
    }
    setLocale(next)
    toast.success(t('languageChanged'))
    router.refresh()
    setPendingLocale(null)
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) { toast.error(t('passwordTooShort')); return }
    if (newPassword !== confirmPassword) { toast.error(t('passwordsDontMatch')); return }
    setSavingPw(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message)
    else {
      toast.success(t('passwordChanged'))
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPw(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== profile.username) { toast.error(t('usernameIncorrect')); return }
    setDeleting(true)

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: deleteConfirm }),
    })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? t('errorDeleteAccount'))
      setDeleting(false)
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('languageTitle')}</CardTitle>
          <CardDescription>{t('languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => handleLocaleChange(l)}
              disabled={pendingLocale !== null}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                l === locale ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                pendingLocale !== null && 'opacity-60'
              )}
            >
              {pendingLocale === l && <Loader2 className="h-4 w-4 animate-spin" />}
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('changePasswordTitle')}</CardTitle>
          <CardDescription>{t('changePasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">{t('newPassword')}</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
              placeholder={t('newPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">{t('confirmNewPassword')}</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmNewPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPw || !newPassword}>
            {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('changePassword')}
          </Button>
        </CardContent>
      </Card>

      {/* Delete account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t('dangerZone')}</CardTitle>
          <CardDescription>
            {t('dangerZoneDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete_confirm">
              {t.rich('typeToConfirm', { username: profile.username, strong: (chunks) => <span className="font-mono font-medium">@{chunks}</span> })}
            </Label>
            <Input
              id="delete_confirm"
              value={deleteConfirm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirm(e.target.value)}
              placeholder={profile.username}
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deleting || deleteConfirm !== profile.username}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('deletePermanently')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
