'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  href?: string
  onClick?: () => void
  label: string
  className?: string
}

export function BackButton({ href, onClick, label, className }: BackButtonProps) {
  const classes = cn(
    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
    'text-muted-foreground hover:text-foreground',
    className
  )

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={classes}>
        <ChevronLeft />
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={classes}>
      <ChevronLeft />
    </button>
  )
}
