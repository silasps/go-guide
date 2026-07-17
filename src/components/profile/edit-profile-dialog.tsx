'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Profile } from '@/types/database'
import { ProfileForm } from '@/components/dashboard/settings/profile-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

interface Props {
  profile: Profile
}

// Reaproveita o ProfileForm usado em /dashboard/configuracoes sem duplicar
// nenhuma lógica de upload/validação — só muda o container, de aba de
// configurações para um dialog que abre por cima do próprio perfil público
// (equivalente à tela "Editar perfil" do Instagram, que também nunca sai
// do contexto do app).
export function EditProfileDialog({ profile }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('PublicProfile')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" className="flex-1 gap-2">
          <Pencil className="h-4 w-4" />
          {t('editProfile')}
        </Button>
      } />
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editProfile')}</DialogTitle>
        </DialogHeader>
        <ProfileForm profile={profile} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
