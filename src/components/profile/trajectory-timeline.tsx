import Image from 'next/image'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface PastProject {
  id: string
  slug: string | null
  title: string
  description: string | null
  cover_url: string | null
  cover_position: string
  goal_amount: number | null
  current_amount: number
  currency: string
  completed_at: string | null
}

export function TrajectoryTimeline({ username, projects }: { username: string; projects: PastProject[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhum projeto concluído ainda.</p>
  }

  return (
    <div className="space-y-6 relative pl-6 border-l-2 border-border">
      {projects.map(p => (
        <Link key={p.id} href={`/${username}/projetos/${p.slug ?? p.id}`} className="block relative group">
          <div className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-primary" />
          <div className="flex gap-3 p-3 rounded-xl border bg-card group-hover:bg-muted/50 transition-colors">
            {p.cover_url && (
              <div className="relative h-16 w-16 rounded-lg overflow-hidden shrink-0">
                <Image src={p.cover_url} alt={p.title} fill className="object-cover" style={{ objectPosition: p.cover_position }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {p.completed_at ? new Date(p.completed_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Concluído'}
              </p>
              <p className="font-medium text-sm truncate">{p.title}</p>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>}
              {p.goal_amount && (
                <p className="text-xs text-green-600 mt-1">{formatCurrency(p.current_amount, p.currency)} arrecadados</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
