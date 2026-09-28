'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard/financeiro', label: 'Visão geral', exact: true },
  { href: '/dashboard/financeiro/lancamentos', label: 'Lançamentos' },
  { href: '/dashboard/financeiro/recorrentes', label: 'Recorrentes' },
  { href: '/dashboard/financeiro/metas', label: 'Metas' },
  { href: '/dashboard/financeiro/limites', label: 'Limites de gastos' },
  { href: '/dashboard/financeiro/contas', label: 'Contas' },
  { href: '/dashboard/financeiro/categorias', label: 'Categorias' },
  { href: '/dashboard/financeiro/conciliacao', label: 'Conciliação' },
  { href: '/dashboard/financeiro/cambio', label: 'Câmbio' },
  { href: '/dashboard/financeiro/relatorios', label: 'Relatórios' },
  { href: '/dashboard/financeiro/prestacoes', label: 'Prestações' },
]

// A barra já era `overflow-x-auto` — dava pra rolar, só que com
// `scrollbar-hide` não sobrava nenhuma pista visual disso, então as
// últimas abas ("Relatórios"/"Prestações") ficavam de fato escondidas pra
// quem não sabia que podia arrastar (usuário mandou print reportando
// exatamente isso). Em vez de reduzir o número de abas ou empilhar em
// menu, mantém a barra igual (mesma tipografia/sublinhado) e só acrescenta
// affordance de overflow — mesmo padrão de Gmail/Notion/Linear: degradê
// nas bordas quando há mais conteúdo pra rolar, setinhas de clique só no
// desktop (mobile já rola por toque/swipe, não precisa de botão), e a aba
// ativa sempre entra em foco sozinha ao carregar a página.
export function FinanceSubNav() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function updateScrollState() {
      if (!el) return
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }

    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  function scrollByAmount(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="relative border-b -mx-4 md:mx-0">
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-px w-10 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
          <button
            type="button"
            aria-label="Rolar abas pra esquerda"
            onClick={() => scrollByAmount(-160)}
            className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm hover:bg-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-px w-10 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
          <button
            type="button"
            aria-label="Rolar abas pra direita"
            onClick={() => scrollByAmount(160)}
            className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm hover:bg-muted"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      <div ref={scrollRef} className="flex overflow-x-auto scrollbar-hide px-4 md:px-0">
        {items.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              ref={active ? activeRef : undefined}
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
    </div>
  )
}
