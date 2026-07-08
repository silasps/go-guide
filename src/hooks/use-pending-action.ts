'use client'

import { useState, useTransition } from 'react'

type Action = () => void | Promise<void>

/**
 * Mantém um indicador de "pendente" ativo durante uma ação assíncrona que
 * termina em router.refresh() e/ou router.push(). router.refresh() não
 * retorna uma Promise que espera o RSC terminar de re-buscar/re-renderizar —
 * zerar o loading logo em seguida faz o spinner sumir antes da UI mudar de
 * fato. Rodando a ação dentro de startTransition, o React/Next.js mantêm
 * isPending=true até o novo payload ser buscado e commitado.
 *
 * T identifica QUAL ação está pendente (id do item, locale clicado, etc.).
 * pendingValue já vem gateado por isPending — nunca precisa ser limpo manualmente.
 */
export function usePendingAction<T = true>() {
  const [value, setValue] = useState<T | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(next: T, action: Action) {
    setValue(next)
    startTransition(async () => {
      await action()
    })
  }

  return { pendingValue: isPending ? value : null, isPending, run }
}
