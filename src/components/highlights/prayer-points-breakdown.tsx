import { ProjectPrayerPoint } from '@/types/database'
import { PrayForPointModal } from '@/components/prayer/pray-for-point-modal'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HandHeart } from 'lucide-react'

interface Props {
  profileId: string
  highlightId: string
  missionaryName: string
  points: ProjectPrayerPoint[]
  /** Ausente no contexto de edição/gestão (só leitura, sem botão de orar). */
  canPray?: boolean
}

function prayerCountLabel(point: ProjectPrayerPoint): string {
  const count = point.prayer_count
  if (count === 0) return point.is_completed ? 'Ninguém orou por este desafio ainda' : 'Seja a primeira pessoa a orar por isso'
  const people = count === 1 ? 'pessoa' : 'pessoas'
  return point.is_completed
    ? `${count} ${people} oraram por esse desafio`
    : `${count} ${people} ${count === 1 ? 'está' : 'estão'} orando por isso`
}

export function PrayerPointsBreakdown({ profileId, highlightId, missionaryName, points, canPray = true }: Props) {
  return (
    <div className="space-y-3">
      {canPray && (
        <PrayForPointModal
          profileId={profileId}
          highlightId={highlightId}
          missionaryName={missionaryName}
          triggerLabel="Orar por este projeto"
          triggerClassName={cn(buttonVariants({ variant: 'support', size: 'lg' }), 'w-full text-base gap-2')}
        />
      )}

      {points.length > 0 && (
        <div className="space-y-2.5">
          {points.map((p) => (
            <div key={p.id} className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className={cn('text-sm font-medium', p.is_completed && 'text-muted-foreground line-through decoration-1')}>{p.title}</span>
                {p.is_completed && <span className="text-xs shrink-0">✅</span>}
              </div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-support flex items-center gap-1">
                  <HandHeart className="h-3 w-3" /> {prayerCountLabel(p)}
                </p>
                {canPray && (
                  <PrayForPointModal
                    profileId={profileId}
                    highlightId={highlightId}
                    prayerPointId={p.id}
                    missionaryName={missionaryName}
                    triggerLabel="Orar por isso"
                    triggerClassName={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs px-2.5 shrink-0 border-support text-support hover:bg-support/10 hover:text-support gap-1')}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
