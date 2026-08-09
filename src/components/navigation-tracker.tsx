'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { markInAppNavigation } from '@/lib/navigation-tracker'

// Montado uma vez no layout raiz — marca a primeira troca de rota real
// (pula o pathname inicial, que não é navegação nenhuma) pra `BackButton`
// saber se `router.back()` tem uma página nossa de verdade pra onde ir.
export function NavigationTracker() {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    markInAppNavigation()
  }, [pathname])

  return null
}
