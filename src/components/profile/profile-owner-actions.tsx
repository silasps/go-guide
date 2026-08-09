'use client'

import { useTranslations } from 'next-intl'
import { Profile } from '@/types/database'
import { EditProfileDialog } from '@/components/profile/edit-profile-dialog'
import { ShareButton } from '@/components/shared/share-button'

interface Props {
  profile: Profile
}

// Substitui o ProfileCTA (Parceria/Oração/Mensagem) quando quem está
// vendo o perfil é o próprio dono/gestor — equivalente aos botões
// "Editar perfil" / "Compartilhar perfil" do Instagram.
export function ProfileOwnerActions({ profile }: Props) {
  const t = useTranslations('PublicProfile')

  return (
    <div className="flex gap-3">
      <EditProfileDialog profile={profile} />
      <ShareButton
        className="flex-1"
        url={typeof window !== 'undefined' ? `${window.location.origin}/${profile.username}` : `/${profile.username}`}
        title={profile.display_name}
        label={t('shareProfile')}
        copiedLabel={t('linkCopied')}
      />
    </div>
  )
}
