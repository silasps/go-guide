'use client'

import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VariantProps } from 'class-variance-authority'

interface Props {
  url: string
  title: string
  label: string
  copiedLabel: string
  variant?: VariantProps<typeof buttonVariants>['variant']
  className?: string
  /** Só o ícone (com label como aria-label/title) — pra caber num header
   *  compacto, ex. ao lado do título de um projeto. */
  iconOnly?: boolean
}

// Web Share API (celular) com fallback de copiar link (desktop) — extraído
// de profile-owner-actions.tsx pra ser reaproveitado também no botão de
// compartilhar um projeto específico.
export function ShareButton({ url, title, label, copiedLabel, variant = 'outline', className, iconOnly = false }: Props) {
  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // usuário cancelou o compartilhamento — não é um erro
      }
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success(copiedLabel)
  }

  if (iconOnly) {
    return (
      <Button variant={variant} size="icon-sm" className={className} onClick={handleShare} aria-label={label} title={label}>
        <Share2 className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button variant={variant} className={cn('gap-2', className)} onClick={handleShare}>
      <Share2 className="h-4 w-4" />
      {label}
    </Button>
  )
}
