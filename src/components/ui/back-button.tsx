'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { hasInAppNavigation } from '@/lib/navigation-tracker'

interface BackButtonProps {
  /** Destino usado só como rede de segurança quando não há histórico pra
   *  voltar (ex.: aba aberta direto num link compartilhado) — o clique
   *  normal sempre volta pra tela anterior de verdade, nunca pra um
   *  destino fixo, pra "voltar" nunca levar pra um lugar errado. */
  href?: string
  onClick?: () => void
  label: string
  className?: string
}

export function BackButton({ href, onClick, label, className }: BackButtonProps) {
  const router = useRouter()
  const classes = cn(
    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
    'text-muted-foreground hover:text-foreground',
    className
  )

  function handleClick() {
    if (onClick) return onClick()
    // `window.history.length > 1` sozinho não basta — abas novas (link
    // compartilhado) às vezes já chegam com length > 1 sem ter pra onde
    // voltar de verdade dentro do app (ver `navigation-tracker.ts`).
    if (hasInAppNavigation()) router.back()
    else if (href) router.push(href)
  }

  return (
    <button type="button" onClick={handleClick} aria-label={label} title={label} className={classes}>
      <ChevronLeft />
    </button>
  )
}
