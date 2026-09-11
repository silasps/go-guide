'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { usePendingActionsCount } from '@/hooks/use-pending-action'

// Trava navegação enquanto algum `usePendingAction` (em qualquer lugar do
// app — Configurações, financeiro, editor de projeto, composer de post)
// está de fato em andamento, pra nunca perder uma escrita em progresso.
// Cobre os dois jeitos de "sair": fechar/atualizar a aba (aviso nativo do
// navegador, o máximo que dá pra travar nesse caso) e navegar pra outra
// página dentro do próprio app (clique em link, interceptado e bloqueado).
export function NavigationGuard() {
  const t = useTranslations('NavigationGuard')
  const pendingCount = usePendingActionsCount()

  useEffect(() => {
    if (pendingCount === 0) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      // Não intercepta âncoras internas (#id), links em nova aba, nem
      // cliques com modificador (abrir em nova aba/janela) — só navegação
      // de verdade pra outra página dentro da aba atual.
      if (href.startsWith('#') || anchor.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      e.stopPropagation()
      toast.info(t('waitForSave'))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [pendingCount, t])

  return null
}
