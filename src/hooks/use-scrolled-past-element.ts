'use client'

import { useEffect, useState } from 'react'

// Fica `true` só quando o elemento de `targetId` saiu por cima da
// viewport (rolou pra baixo além dele) — usado por CTAs flutuantes que só
// devem aparecer depois que o CTA "de verdade" já saiu de vista.
// `!isIntersecting` sozinho também é true antes de chegar no elemento (ele
// ainda está mais abaixo na página); `boundingClientRect.top < 0` descarta
// esse caso e só sobra "já passei por cima dele".
export function useScrolledPastElement(targetId: string): boolean {
  const [scrolledPast, setScrolledPast] = useState(false)

  useEffect(() => {
    const el = document.getElementById(targetId)
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [targetId])

  return scrolledPast
}
