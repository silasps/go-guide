'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Profile } from '@/types/database'
import { EditProfileDialog } from '@/components/profile/edit-profile-dialog'
import { Button } from '@/components/ui/button'
import { Share2 } from 'lucide-react'

interface Props {
  profile: Profile
}

// Substitui o ProfileCTA (Parceria/Oração/Mensagem) quando quem está
// vendo o perfil é o próprio dono/gestor — equivalente aos botões
// "Editar perfil" / "Compartilhar perfil" do Instagram.
export function ProfileOwnerActions({ profile }: Props) {
  const t = useTranslations('PublicProfile')

  async function handleShare() {
    const url = `${window.location.origin}/${profile.username}`
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.display_name, url })
      } catch {
        // usuário cancelou o compartilhamento — não é um erro
      }
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success(t('linkCopied'))
  }

  return (
    <div className="flex gap-3">
      <EditProfileDialog profile={profile} />
      <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
        <Share2 className="h-4 w-4" />
        {t('shareProfile')}
      </Button>
    </div>
  )
}
