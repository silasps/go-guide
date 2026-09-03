'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'

export interface BroadcastProject {
  title: string
  slug: string | null
  cover_url: string | null
  goal_amount: number | null
  current_amount: number
  currency: string
}

interface Props {
  project: BroadcastProject
  username: string
  accent: string
}

// Entrada escalonada fica a cargo de <RevealItem> no lugar de chamada (a
// lista inteira já está dentro de um <Reveal>) — este componente só cuida
// do que é intrínseco ao card: barra de progresso crescendo e o leve
// lift no hover. Sem cover_url, mostra um bloco gradiente na cor de
// destaque do perfil em vez de simplesmente omitir a foto — o card nunca
// fica "incompleto" visualmente, mesmo sem imagem.
export function BroadcastProjectCard({ project, username, accent }: Props) {
  const pct = project.goal_amount ? Math.min(100, Math.round((project.current_amount / project.goal_amount) * 100)) : null
  const remaining = project.goal_amount ? Math.max(0, project.goal_amount - project.current_amount) : null
  const href = project.slug ? `/${username}/projetos/${project.slug}` : `/${username}`
  const initial = project.title.trim().charAt(0).toUpperCase()

  return (
    <motion.a
      href={href}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="block bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
    >
      {project.cover_url ? (
        <div className="relative h-36 w-full">
          <Image src={project.cover_url} alt={project.title} fill className="object-cover" />
        </div>
      ) : (
        <div
          className="h-36 w-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
        >
          <span className="text-4xl font-bold text-white/90">{initial}</span>
        </div>
      )}
      <div className="p-4 space-y-2">
        <p className="font-semibold text-sm">{project.title}</p>
        {pct !== null && (
          <>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: `${accent}26` }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: accent }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(project.current_amount, project.currency)} de {formatCurrency(project.goal_amount as number, project.currency)} ({pct}%)
              {remaining && remaining > 0 ? ` — faltam ${formatCurrency(remaining, project.currency)}` : ''}
            </p>
          </>
        )}
        <span
          className="inline-block text-xs font-semibold text-white px-3 py-1.5 rounded-lg mt-1"
          style={{ background: accent }}
        >
          Ver projeto e contribuir →
        </span>
      </div>
    </motion.a>
  )
}
