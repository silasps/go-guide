'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PULL_THRESHOLD = 70
const MAX_PULL = 100
const RESISTANCE = 0.5

/** Pull-to-refresh estilo app nativo — arrastar pra baixo já no topo
 *  recarrega a página. Existe porque o navegador não faz isso sozinho no
 *  modo PWA instalado ("adicionar à tela inicial"): sem a chrome do
 *  navegador, some o gesto nativo do Chrome/Safari (mesmo cenário que já
 *  motivou a `SplashScreen`, ver comentário lá). Ignora o gesto se começar
 *  dentro de um modal (`[data-slot="dialog-content"]`, o `DialogContent`
 *  base usado por todo `Dialog` do app) — modal tem o próprio scroll
 *  interno, puxar lá dentro não deve recarregar o app inteiro por baixo. */
export function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const distanceRef = useRef(0)

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (refreshing) return
      if (window.scrollY > 0) return
      if ((e.target as HTMLElement | null)?.closest('[data-slot="dialog-content"]')) return
      startY.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0 || window.scrollY > 0) {
        startY.current = null
        distanceRef.current = 0
        setPullDistance(0)
        return
      }
      e.preventDefault()
      const next = Math.min(MAX_PULL, delta * RESISTANCE)
      distanceRef.current = next
      setPullDistance(next)
    }

    function onTouchEnd() {
      if (startY.current === null) return
      startY.current = null
      if (distanceRef.current >= PULL_THRESHOLD) {
        setRefreshing(true)
        window.location.reload()
      } else {
        distanceRef.current = 0
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [refreshing])

  if (pullDistance === 0 && !refreshing) return null

  const pastThreshold = pullDistance >= PULL_THRESHOLD || refreshing

  return (
    <div
      aria-hidden
      className="fixed top-3 left-1/2 z-[60] flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-border"
      style={{
        transform: `translateX(-50%) translateY(${Math.max(0, pullDistance - 36)}px)`,
        opacity: refreshing ? 1 : Math.min(1, pullDistance / 30),
      }}
    >
      <Loader2 className={cn('h-4 w-4 text-primary', pastThreshold && 'animate-spin')} />
    </div>
  )
}
