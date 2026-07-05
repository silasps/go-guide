'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile
}

export function AccountForm({ profile }: Props) {
  const router = useRouter()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

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
    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-6">
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
