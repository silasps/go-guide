'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Profile } from '@/types/database'
import { ProfileForm } from '@/components/dashboard/settings/profile-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pencil, ArrowLeft } from 'lucide-react'

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
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full overflow-y-hidden max-w-none sm:max-w-none rounded-none p-0 gap-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:flex-none md:w-full md:h-auto md:max-w-lg md:max-h-[85vh] md:rounded-xl md:p-4 md:gap-4"
      >
        {/* Cabeçalho: seta voltar + título centralizado, estilo Instagram —
            substitui o X de fechar padrão do Dialog só nesta tela. */}
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 px-4 py-3 border-b shrink-0 md:border-b-0 md:px-0 md:pt-0 md:pb-2">
          <button
            onClick={() => setOpen(false)}
            aria-label={t('closeEdit')}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <DialogTitle className="text-center text-base">{t('editProfile')}</DialogTitle>
          <div />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-0">
          <ProfileForm profile={profile} onSaved={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
