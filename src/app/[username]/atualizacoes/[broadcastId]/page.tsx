import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile/get-profile'
import { formatCurrency, getInitials } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { PartnerUpdateFinancial } from '@/lib/ai/generate-partner-update'

interface Props { params: Promise<{ username: string; broadcastId: string }> }

interface PublicProject {
  title: string
  slug: string | null
  cover_url: string | null
  goal_amount: number | null
  current_amount: number
  currency: string
}

interface PublicBroadcast {
  profile_id: string
  subject: string
  body: string
  highlight_ids: string[]
  financial_snapshot: PartnerUpdateFinancial | null
  created_at: string
}

// Landing page pública de uma atualização (system.architecture.md 7.10-bis)
// — pra o missionário copiar o link e mandar por WhatsApp. Chrome própria,
// sem a barra de abas do perfil (profile-tabs.tsx já exclui essa rota,
// mesmo motivo de /parceria). Leitura via função SECURITY DEFINER
// (get_public_broadcast, migration 072) — nunca a tabela direto, que é
// fechada pro dono.
export default async function AtualizacaoPage({ params }: Props) {
  const { username, broadcastId } = await params
  const profile = await getProfile(username)
  if (!profile) notFound()

  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_broadcast', { p_id: broadcastId }).maybeSingle()
  const broadcast = data as PublicBroadcast | null
  if (!broadcast || broadcast.profile_id !== profile.id) notFound()

  const financial = broadcast.financial_snapshot

  let projects: PublicProject[] = []
  if (broadcast.highlight_ids?.length) {
    const { data } = await supabase
      .from('highlights')
      .select('title, slug, cover_url, goal_amount, current_amount, currency')
      .in('id', broadcast.highlight_ids)
    projects = data ?? []
  }

  const dateLabel = new Date(broadcast.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
            <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{profile.display_name}</p>
            <p className="text-xs text-muted-foreground">Atualização de {dateLabel}</p>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-5">
          <h1 className="font-semibold text-lg mb-3">{broadcast.subject}</h1>
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{broadcast.body}</div>
        </div>

        {financial && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(financial.incomeByCurrency).map(([currency, value]) => (
              <StatTile key={`in-${currency}`} label="Arrecadado" value={formatCurrency(value, currency)} accent={profile.accent_color} />
            ))}
            {Object.entries(financial.expenseByCurrency).map(([currency, value]) => (
              <StatTile key={`out-${currency}`} label="Investido na missão" value={formatCurrency(value, currency)} accent={profile.accent_color} muted />
            ))}
          </div>
        )}

        {projects.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projetos em andamento</p>
            {projects.map((p) => (
              <ProjectCard key={p.slug ?? p.title} project={p} username={username} accent={profile.accent_color} />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Enviado com carinho por {profile.display_name} — go→guide
        </p>
      </div>
    </div>
  )
}

function StatTile({ label, value, accent, muted }: { label: string; value: string; accent: string; muted?: boolean }) {
  return (
    <div className="bg-card border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: muted ? undefined : accent }}>{value}</p>
    </div>
  )
}

function ProjectCard({ project, username, accent }: { project: PublicProject; username: string; accent: string }) {
  const pct = project.goal_amount ? Math.min(100, Math.round((project.current_amount / project.goal_amount) * 100)) : null
  const remaining = project.goal_amount ? Math.max(0, project.goal_amount - project.current_amount) : null
  const href = project.slug ? `/${username}/projetos/${project.slug}` : `/${username}`

  return (
    <a href={href} className="block bg-card border rounded-2xl overflow-hidden hover:opacity-95 transition-opacity">
      {project.cover_url && (
        <div className="relative h-36 w-full">
          <Image src={project.cover_url} alt={project.title} fill className="object-cover" />
        </div>
      )}
      <div className="p-4 space-y-2">
        <p className="font-semibold text-sm">{project.title}</p>
        {pct !== null && (
          <>
            <div className="h-2 rounded-full" style={{ background: `${accent}26` }}>
              <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: accent }} />
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
    </a>
  )
}
