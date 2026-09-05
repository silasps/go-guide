'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Depois de criar conta/logar no meio do fluxo de parceria (ver
// NeedsAccountCard, usado por RecurringPledgeForm e ScheduledPledgeForm),
// o navegador dá um reload completo (window.location.href, em login/page.tsx
// e cadastro/page.tsx) — se ele caísse direto em `/username/parceria`, essa
// navegação nasceria fora da árvore de rotas do perfil, e a rota interceptada
// (@modal/(.)parceria) nunca entraria em jogo: a pessoa veria a tela cheia
// em vez do modal que abriu antes de precisar de conta. Por isso o redirect
// pousa aqui, na página normal do perfil (que já dispara o intercept ao
// clicar em "Seja Parceiro"), e este componente só empurra pra
// `/username/parceria?choice=...` por navegação client-side — dessa vez
// nascendo de dentro da árvore certa, então o modal abre normalmente.
export function ResumePartnership({ username }: { username: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeChoice = searchParams.get('resumeChoice')
  const resumeHighlightId = searchParams.get('resumeHighlightId')

  useEffect(() => {
    if (!resumeChoice) return
    const query = resumeHighlightId ? `?choice=${resumeChoice}&highlight_id=${resumeHighlightId}` : `?choice=${resumeChoice}`
    // Limpa resumeChoice da entrada de histórico ANTES de empilhar o modal
    // por cima (replace, não push) — senão ela continua existindo por
    // baixo do modal com o parâmetro intacto, e qualquer "voltar" (clique
    // fora do modal, botão voltar do navegador) cai de novo nela, o efeito
    // dispara de novo e reabre o modal num loop infinito de abrir/fechar.
    router.replace(`/${username}`)
    router.push(`/${username}/parceria${query}`)
  }, [resumeChoice, resumeHighlightId, username, router])

  return null
}
