'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  month: string // 'YYYY-MM'
  monthLabel: string // 'Setembro 2026'
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Navegador simples (só troca a query string `?month=`, o Server Component
// da página refaz a busca) — sem o carrossel de meses do `MonthNavigator` da
// Visão Geral, que é overkill pra essa tela.
export function MonthLimitNav({ month, monthLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function go(delta: number) {
    router.push(`${pathname}?month=${shiftMonth(month, delta)}`)
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Button type="button" variant="outline" size="icon-sm" onClick={() => go(-1)} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[150px] text-center text-sm font-semibold px-3">{monthLabel}</span>
      <Button type="button" variant="outline" size="icon-sm" onClick={() => go(1)} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
