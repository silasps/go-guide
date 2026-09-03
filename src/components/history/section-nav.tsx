'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll'

export interface HistorySection {
  id: string
  label: string
}

interface Props {
  sections: HistorySection[]
  /** Altura de qualquer header fixo acima desta nav (ela gruda logo abaixo). */
  scrollOffset?: number
  className?: string
}

// Scrollspy: rola até a seção ao clicar e destaca a seção visível conforme
// a página rola, em vez de esconder o resto do conteúdo (tabs de verdade
// deixariam o Convite inacessível pra quem não clicasse em todas as abas).
export function HistorySectionNav({ sections, scrollOffset = 0, className }: Props) {
  const [activeId, setActiveId] = useState(sections[0]?.id)
  // Mesmo hook do header global (ProfileTabs) — como os dois reagem ao
  // mesmo scroll da window, saem em sincronia: quando o header soma e
  // desaparece, esta nav "sobe" junto (top vira 0) em vez de ficar grudada
  // no offset antigo, deixando um vão vazado por onde o conteúdo por trás
  // aparecia ao rolar (bug reportado pelo usuário).
  const headerHidden = useHideOnScroll()
  const top = headerHidden ? 0 : scrollOffset

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    // A seção anterior (ex.: Linha do tempo, longa) costuma ser mais alta
    // que a janela de detecção e continua "intersectando" mesmo com a
    // página já no fim, disputando com a IntersectionObserver a cada
    // notificação — por isso o cheque de "chegou ao fim" tem que ser a
    // ÚLTIMA palavra dentro do mesmo callback, nunca um listener à parte
    // (dois listeners independentes correm risco de um sobrescrever o
    // outro fora de ordem).
    const lastId = sections[sections.length - 1]?.id
    function isAtBottom() {
      const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      return window.innerHeight + window.scrollY >= scrollHeight - 24
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (isAtBottom() && lastId) { setActiveId(lastId); return }
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: `-${scrollOffset + 8}px 0px -70% 0px`, threshold: 0 }
    )
    elements.forEach((el) => observer.observe(el))

    function onScroll() {
      if (isAtBottom() && lastId) setActiveId(lastId)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [sections, scrollOffset])

  function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    // scrollIntoView acha o ancestral rolável certo sozinho (funciona tanto
    // na página pública, que rola a window, quanto no dashboard, que rola
    // um <main> interno) — o offset do header fixo é compensado via
    // scroll-margin-top nos próprios elementos de seção.
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  if (sections.length < 2) return null

  return (
    <nav
      className={cn('sticky z-10 py-2 bg-background/95 backdrop-blur border-b transition-[top] duration-300', className)}
      style={{ top }}
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              activeId === s.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
