'use client'

import { useEffect, useState } from 'react'

// Cobre o "flash" de tela branca no carregamento inicial (mais perceptível
// no celular, principalmente no modo "adicionar à tela inicial"/PWA, onde
// a rede+hidratação demoram alguns segundos e parece que travou). Faz parte
// do HTML já renderizado no servidor (não depende de JS pra aparecer), e se
// auto-remove assim que o React hidrata no cliente.
//
// Loop com 5 poses reais de passada (desenhadas pelo usuário, com "Go guide"
// já embutido em cada frame na mesma posição — o texto fica parado enquanto
// só as pernas se movem).
const WALK_FRAMES = ['/splash/walk-1.png', '/splash/walk-2.png', '/splash/walk-3.png', '/splash/walk-4.png', '/splash/walk-5.png']
const FRAME_MS = 220

export function SplashScreen() {
  const [hidden, setHidden] = useState(false)
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
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % WALK_FRAMES.length)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={WALK_FRAMES[frame]}
        alt=""
        width={307}
        height={270}
        className="h-40 w-auto sm:h-48"
      />
    </div>
  )
}
