'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(profile.locale)
  const [savingLocale, setSavingLocale] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleLocaleChange(next: Locale) {
    if (next === locale || savingLocale) return
    setSavingLocale(true)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ locale: next }).eq('id', profile.id)
    setSavingLocale(false)
    if (error) { toast.error('Erro ao salvar idioma.'); return }
    setLocale(next)
    router.refresh()
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) { toast.error('Mínimo 8 caracteres.'); return }
    if (newPassword !== confirmPassword) { toast.error('Senhas não coincidem.'); return }
    setSavingPw(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message)
    else {
      toast.success('Senha alterada com sucesso!')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPw(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== profile.username) { toast.error('Username incorreto.'); return }
    setDeleting(true)

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: deleteConfirm }),
    })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Erro ao excluir conta.')
      setDeleting(false)
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="space-y-6">
      {/* Idioma — o resto do painel ainda está só em português (tradução completa é a próxima fase) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idioma</CardTitle>
          <CardDescription>Escolha o idioma do site público e desta preferência de conta.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => handleLocaleChange(l)}
              disabled={savingLocale}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                l === locale ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterar senha</CardTitle>
          <CardDescription>Escolha uma senha forte com pelo menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">Nova senha</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar nova senha</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPw || !newPassword}>
            {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Alterar senha
          </Button>
        </CardContent>
      </Card>

      {/* Delete account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona de perigo</CardTitle>
          <CardDescription>
            Excluir a conta remove permanentemente todos os seus dados. Esta ação não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete_confirm">
              Digite <span className="font-mono font-medium">@{profile.username}</span> para confirmar
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
            Excluir conta permanentemente
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
