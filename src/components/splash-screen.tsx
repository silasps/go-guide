'use client'

import { useEffect, useState } from 'react'

// Cobre o "flash" de tela branca no carregamento inicial (mais perceptível
// no celular, principalmente no modo "adicionar à tela inicial"/PWA, onde
// a rede+hidratação demoram alguns segundos e parece que travou). Faz parte
// do HTML já renderizado no servidor (não depende de JS pra aparecer), e se
// auto-remove assim que o React hidrata no cliente.
//
// Duas fases: (1) a marca "GO" pisca por um instante, (2) a figura entra
// em loop de passo, alternando 3 poses de passada reais (não só o quique
// de CSS) pra dar sensação de "andando pra frente".
const WALK_FRAMES = ['/splash/walk-1.png', '/splash/walk-2.png', '/splash/walk-3.png']
const FRAME_MS = 260
const BLINK_PHASE_MS = 900

export function SplashScreen() {
  const [hidden, setHidden] = useState(false)
  const [walking, setWalking] = useState(false)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    // ?splash=preview mantém a splash visível pra sempre, sem depender do
    // tempo real de carregamento — só pra revisar a animação com calma.
    const forcePreview = new URLSearchParams(window.location.search).get('splash') === 'preview'
    if (forcePreview) return
    const id = setTimeout(() => setHidden(true), 0)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setWalking(true), BLINK_PHASE_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!walking) return
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % WALK_FRAMES.length)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [walking])

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {!walking ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/icon-mark.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 animate-[splash-blink_0.45s_ease-in-out_infinite]"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={WALK_FRAMES[frame]}
          alt=""
          width={176}
          height={179}
          className="h-20 w-auto animate-[splash-step_0.52s_ease-in-out_infinite]"
        />
      )}
    </div>
  )
}
