'use client'

import { useTranslations } from 'next-intl'
import { UserRole } from '@/types/database'
import { useComposer } from '@/components/dashboard/post-composer-provider'
import { Plus } from 'lucide-react'

interface Props {
  role: UserRole
}

// FAB estilo X/Twitter — parceiros não criam post/projeto, só missionários.
// A escolha "Post vs. Projeto" acontece dentro do próprio composer
// (StepTypePicker, tela cheia) — abrir direto evita perguntar duas vezes.
export function CreateContentFab({ role }: Props) {
  const t = useTranslations('CreateContent')
  const { openComposer } = useComposer()
  if (role === 'partner') return null

  return (
    <button
      type="button"
      onClick={() => openComposer()}
      aria-label={t('ariaLabel')}
      className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 shadow-lg flex items-center justify-center"
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
