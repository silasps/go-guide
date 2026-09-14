'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Reveal, RevealItem } from './reveal'

export interface PeriodTimelineItem {
  id: string
  title: string
  /** Já formatada no Server Component (page.tsx), locale-aware — este
   *  componente não decide idioma/formato de data, só exibe. */
  dateLabel: string
  projectTitle: string
  coverUrl: string | null
  href: string
}

interface Props {
  items: PeriodTimelineItem[]
  heading: string
}

// Linha do tempo do período — reaproveita o padrão visual de
// TrajectoryTimeline (src/components/profile/trajectory-timeline.tsx: dot +
// linha vertical + card), mas lista marcos (`milestones`) concluídos dentro
// da janela de datas da prestação de contas, não projetos inteiros. Só
// dados 100% automáticos (milestone já marcado como concluído no
// dashboard) — nunca texto livre de lançamento (ver plano de privacidade).
export function BroadcastPeriodTimeline({ items, heading }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{heading}</p>
      <Reveal onScroll className="space-y-3 relative pl-5 border-l-2 border-border">
        {items.map((item) => (
          <RevealItem key={item.id} className="relative">
            <div className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <Link href={item.href} className="flex gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors">
              {item.coverUrl && (
                <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0">
                  <Image src={item.coverUrl} alt={item.projectTitle} fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{item.dateLabel} · {item.projectTitle}</p>
                <p className="font-medium text-sm truncate">🎉 {item.title}</p>
              </div>
            </Link>
          </RevealItem>
        ))}
      </Reveal>
    </div>
  )
}
