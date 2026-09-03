import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile/get-profile'
import { getInitials } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { PartnerUpdateFinancial } from '@/lib/ai/generate-partner-update'
import { FinancialVisibility } from '@/types/database'
import { Reveal, RevealItem } from '@/components/partners/broadcast/reveal'
import { BroadcastStatTile } from '@/components/partners/broadcast/stat-tile'
import { BroadcastCategoryChart, CategoryChartItem } from '@/components/partners/broadcast/category-chart'
import { BroadcastProjectCard, BroadcastProject } from '@/components/partners/broadcast/project-card'

interface Props { params: Promise<{ username: string; broadcastId: string }> }

interface PublicBroadcast {
  profile_id: string
  subject: string
  body: string
  highlight_ids: string[]
  financial_snapshot: PartnerUpdateFinancial | null
  financial_visibility: FinancialVisibility
  created_at: string
}

// Categorias de gasto -> itens do gráfico (barra horizontal, mesma forma do
// dashboard financeiro — 11.1). `includeAmounts=false` nunca inclui a chave
// `amount` no objeto de retorno (não só omite na UI) — minimização de dado
// igual à Fase 1, pro modo percent_only sem grant.
function computeCategoryItems(financial: PartnerUpdateFinancial, includeAmounts: boolean): CategoryChartItem[] {
  const currencies = Object.entries(financial.expenseByCurrency)
  if (currencies.length === 0) return []
  const [dominantCurrency, totalExpense] = currencies.reduce((a, b) => (b[1] > a[1] ? b : a))
  if (totalExpense <= 0) return []

  const top: CategoryChartItem[] = financial.topExpenseCategories
    .filter((c) => c.currency === dominantCurrency)
    .map((c) => {
      const pct = Math.round((c.amount / totalExpense) * 100)
      return includeAmounts ? { name: c.name, pct, amount: c.amount } : { name: c.name, pct }
    })

  const othersPct = Math.max(0, 100 - top.reduce((sum, c) => sum + c.pct, 0))
  if (othersPct <= 0) return top

  if (!includeAmounts) return [...top, { name: 'Outros', pct: othersPct }]
  const knownAmount = top.reduce((sum, c) => sum + (c.amount ?? 0), 0)
  return [...top, { name: 'Outros', pct: othersPct, amount: Math.max(0, totalExpense - knownAmount) }]
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

  // Redação da prestação de contas: modo 'percent_only' esconde valores
  // exatos de quem não tem o grant `financial_summary` (partner_visibility_
  // grants, migration 011). A checagem de fato acontece no banco (SECURITY
  // DEFINER, mesma técnica de is_authorized_partner/has_partner_grant,
  // migration 011) — aqui só decide o que renderizar. Isso é seguro porque
  // esta página é um Server Component puro: os componentes visuais abaixo
  // (BroadcastStatTile/BroadcastCategoryChart/BroadcastProjectCard) viram
  // Client Components só pra animação, mas cada um só recebe os campos já
  // computados/redigidos aqui — nunca o `financial_snapshot` bruto inteiro
  // — então o valor exato nunca é serializado pro navegador quando o
  // visitante não está autorizado a vê-lo.
  const { data: hasFinancialGrant } = await supabase.rpc('has_partner_grant', {
    p_profile_id: broadcast.profile_id,
    p_section: 'financial_summary',
  })
  const canSeeExactFinancial = broadcast.financial_visibility !== 'percent_only' || !!hasFinancialGrant
  const categoryItems = financial ? computeCategoryItems(financial, canSeeExactFinancial) : []

  let projects: BroadcastProject[] = []
  if (broadcast.highlight_ids?.length) {
    const { data } = await supabase
      .from('highlights')
      .select('title, slug, cover_url, goal_amount, current_amount, currency')
      .in('id', broadcast.highlight_ids)
    projects = data ?? []
  }

  const dateLabel = new Date(broadcast.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const accent = profile.accent_color

  return (
    <div className="min-h-screen bg-muted/30 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-72 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent}22, transparent 70%)` }}
      />

      <Reveal className="relative max-w-lg mx-auto px-4 py-8 space-y-6">
        <RevealItem className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
            <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{profile.display_name}</p>
            <p className="text-xs text-muted-foreground">Atualização de {dateLabel}</p>
          </div>
        </RevealItem>

        <RevealItem className="bg-card border rounded-2xl p-5">
          <h1 className="font-semibold text-lg mb-3">{broadcast.subject}</h1>
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{broadcast.body}</div>
        </RevealItem>

        {financial && canSeeExactFinancial && (
          <RevealItem className="grid grid-cols-2 gap-3">
            {Object.entries(financial.incomeByCurrency).map(([currency, value]) => (
              <BroadcastStatTile key={`in-${currency}`} label="Arrecadado" value={value} currency={currency} variant="income" />
            ))}
            {Object.entries(financial.expenseByCurrency).map(([currency, value]) => (
              <BroadcastStatTile key={`out-${currency}`} label="Investido na missão" value={value} currency={currency} variant="expense" />
            ))}
          </RevealItem>
        )}

        {categoryItems.length > 0 && (
          <RevealItem>
            <BroadcastCategoryChart
              items={categoryItems}
              currency={Object.keys(financial?.expenseByCurrency ?? {})[0] ?? 'BRL'}
              heading="Como o dinheiro foi usado"
              footnote={canSeeExactFinancial ? undefined : `Valores exatos disponíveis para parceiros autorizados por ${profile.display_name}.`}
            />
          </RevealItem>
        )}

        {projects.length > 0 && (
          <RevealItem className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projetos em andamento</p>
            <Reveal className="space-y-3">
              {projects.map((p) => (
                <RevealItem key={p.slug ?? p.title}>
                  <BroadcastProjectCard project={p} username={username} accent={accent} />
                </RevealItem>
              ))}
            </Reveal>
          </RevealItem>
        )}

        <RevealItem className="text-center text-xs text-muted-foreground pt-4">
          Enviado com carinho por {profile.display_name} — go→guide
        </RevealItem>
      </Reveal>
    </div>
  )
}
