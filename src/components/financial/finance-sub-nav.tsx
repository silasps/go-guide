'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard/financeiro', label: 'Visão geral', exact: true },
  { href: '/dashboard/financeiro/lancamentos', label: 'Lançamentos' },
  { href: '/dashboard/financeiro/contas', label: 'Contas' },
  { href: '/dashboard/financeiro/categorias', label: 'Categorias' },
  { href: '/dashboard/financeiro/conciliacao', label: 'Conciliação' },
  { href: '/dashboard/financeiro/cambio', label: 'Câmbio' },
]

export function FinanceSubNav() {
  const pathname = usePathname()
  return (
    <div className="flex border-b overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
      {items.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
