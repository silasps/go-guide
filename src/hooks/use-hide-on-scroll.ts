'use client'

import { useEffect, useRef, useState } from 'react'

// Esconde ao rolar pra baixo, mostra de novo ao rolar pra cima (padrão
// Instagram/Twitter). Assimétrico de propósito: rolar pra cima só um
// pouco (`showThreshold` baixo) já traz a barra de volta em qualquer
// ponto da página — reportado pelo usuário, que só via a barra reaparecer
// perto do topo; rolar pra baixo exige um pouco mais (`hideThreshold`)
// pra não sumir a cada tremor pequeno. Não esconde perto do topo, pra não
// sumir a barra assim que a página carrega.
export function useHideOnScroll(hideThreshold = 12, showThreshold = 4) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const diff = y - lastY.current
      if (diff > hideThreshold && y > 64) {
        setHidden(true)
        lastY.current = y
      } else if (diff < -showThreshold) {
        setHidden(false)
        lastY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [hideThreshold, showThreshold])

  return hidden
}
