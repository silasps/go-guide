'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else if (href) router.push(href)
  }

  return (
    <button type="button" onClick={handleClick} aria-label={label} title={label} className={classes}>
      <ChevronLeft />
    </button>
  )
}
