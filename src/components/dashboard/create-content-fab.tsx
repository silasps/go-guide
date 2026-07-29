'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { UserRole } from '@/types/database'
import { useComposer } from '@/components/dashboard/post-composer-provider'
import { Plus } from 'lucide-react'

interface Props {
  role: UserRole
}

// Só nas telas onde criar post/projeto faz sentido de cara (feed, projetos,
// publicações) — nas outras, o botão "Nova publicação" da sidebar (desktop)
// e o menu de conta (mobile) continuam dando acesso, só não como FAB fixo.
// "/dashboard" é exato (só o feed) — as outras casam com subrotas também.
function isFabPath(pathname: string) {
  if (pathname === '/dashboard') return true
  return ['/dashboard/projetos', '/dashboard/publicacoes'].some((p) => pathname.startsWith(p))
}

// FAB estilo X/Twitter — parceiros não criam post/projeto, só missionários.
// A escolha "Post vs. Projeto" acontece dentro do próprio composer
// (StepTypePicker, tela cheia) — abrir direto evita perguntar duas vezes.
export function CreateContentFab({ role }: Props) {
  const t = useTranslations('CreateContent')
  const { openComposer } = useComposer()
  const pathname = usePathname()
  if (role === 'partner') return null
  if (!isFabPath(pathname)) return null

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
