'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  src: string
  status?: 'ready' | 'processing' | 'failed'
  loop?: boolean
  showMuteButton?: boolean
  showFullscreenButton?: boolean
  className?: string
  processingLabel?: string
  fullscreenLabel?: string
  muteLabel?: string
  unmuteLabel?: string
}

/** Player de vídeo estilo Instagram: autoplay mudo só quando visível na
 *  tela (via IntersectionObserver — essencial pro feed, onde vários vídeos
 *  existem na mesma lista rolável), toque no corpo pausa/retoma, ícone
 *  pequeno alterna som, sem nenhum controle nativo do navegador. */
export function InstagramVideoPlayer({
  src, status = 'ready', loop = true, showMuteButton = true, showFullscreenButton = false,
  className, processingLabel = 'Processando vídeo…', fullscreenLabel = 'Tela cheia',
  muteLabel = 'Silenciar', unmuteLabel = 'Ativar som',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || status !== 'ready') return

    let hls: import('hls.js').default | undefined
    if (src.endsWith('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hls = new Hls()
          hls.loadSource(src)
          hls.attachMedia(video)
        }
      })
    } else {
      video.src = src
    }

    return () => hls?.destroy()
  }, [src, status])

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container || status !== 'ready') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !paused) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.5 }
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [status, paused])

  function togglePlay() {
    setPaused((p) => !p)
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    setMuted((m) => {
      if (videoRef.current) videoRef.current.muted = !m
      return !m
    })
  }

  function toggleFullscreen(e: React.MouseEvent) {
    e.stopPropagation()
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!video) return
    if (video.requestFullscreen) video.requestFullscreen()
    else video.webkitEnterFullscreen?.()
  }

  if (status !== 'ready') {
    return (
      <div className={cn('relative flex items-center justify-center bg-muted', className)}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-5 w-5 animate-spin" />
          {status === 'processing' && processingLabel}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative bg-black', className)} onClick={togglePlay}>
      <video ref={videoRef} muted={muted} loop={loop} playsInline className="w-full h-full object-cover" />

      {showMuteButton && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute bottom-2 right-2 bg-black/50 text-white rounded-full p-1.5"
          aria-label={muted ? unmuteLabel : muteLabel}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      )}

      {showFullscreenButton && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute bottom-2 left-2 bg-black/50 text-white rounded-full p-1.5"
          aria-label={fullscreenLabel}
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
