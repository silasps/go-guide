import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile/get-profile'
import { getInitials, formatLongDate, INTL_LOCALE } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { PartnerUpdateFinancial } from '@/lib/ai/generate-partner-update'
import { FinancialVisibility, Locale } from '@/types/database'
import { Reveal, RevealItem } from '@/components/partners/broadcast/reveal'
import { BroadcastStatTile, BroadcastTrend } from '@/components/partners/broadcast/stat-tile'
import { BroadcastCategoryChart, CategoryChartItem } from '@/components/partners/broadcast/category-chart'
import { BroadcastProjectCard, BroadcastProject } from '@/components/partners/broadcast/project-card'
import { BroadcastPhotoGallery, PeriodPhoto } from '@/components/partners/broadcast/photo-gallery'
import { BroadcastPeriodTimeline, PeriodTimelineItem } from '@/components/partners/broadcast/period-timeline'

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
// igual à Fase 1, pro modo percent_only sem grant. `count`/`firstDate`/
// `lastDate` (contagem + intervalo de datas, nunca a descrição de um
// lançamento) vêm direto do snapshot pra virar a linha expansível do
// gráfico — nunca calculados pro bucket residual `otherLabel`, que não é
// uma categoria de verdade.
function computeCategoryItems(financial: PartnerUpdateFinancial, includeAmounts: boolean, otherLabel: string): CategoryChartItem[] {
  const currencies = Object.entries(financial.expenseByCurrency)
  if (currencies.length === 0) return []
  const [dominantCurrency, totalExpense] = currencies.reduce((a, b) => (b[1] > a[1] ? b : a))
  if (totalExpense <= 0) return []

  const top: CategoryChartItem[] = financial.topExpenseCategories
    .filter((c) => c.currency === dominantCurrency)
    .map((c) => {
      const pct = Math.round((c.amount / totalExpense) * 100)
      const base: CategoryChartItem = { name: c.name, pct, count: c.count, firstDate: c.firstDate, lastDate: c.lastDate }
      return includeAmounts ? { ...base, amount: c.amount } : base
    })

  const othersPct = Math.max(0, 100 - top.reduce((sum, c) => sum + c.pct, 0))
  if (othersPct <= 0) return top

  if (!includeAmounts) return [...top, { name: otherLabel, pct: othersPct, isOther: true }]
  const knownAmount = top.reduce((sum, c) => sum + (c.amount ?? 0), 0)
  return [...top, { name: otherLabel, pct: othersPct, amount: Math.max(0, totalExpense - knownAmount), isOther: true }]
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

  const locale = (await getLocale()) as Locale
  const t = await getTranslations('PartnerUpdate')

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
  const categoryItems = financial ? computeCategoryItems(financial, canSeeExactFinancial, t('otherCategories')) : []

  // Tendência frente ao período anterior do mesmo perfil (migration 103,
  // get_broadcast_trend) — só a direção, nunca valor/percentual (ver
  // comentário da function: um percentual já daria pra recalcular o valor
  // exato do período anterior a partir do atual). `.rpc()` não lança se a
  // function ainda não existir no banco (broadcasts antigos/ambiente sem a
  // migration aplicada) — só volta `data: null`, e a página não mostra a
  // seta, sem quebrar.
  let trend: BroadcastTrend | null = null
  if (financial) {
    const { data: trendData } = await supabase.rpc('get_broadcast_trend', { p_id: broadcastId })
    trend = (trendData as BroadcastTrend | null) ?? null
  }

  let projects: BroadcastProject[] = []
  if (broadcast.highlight_ids?.length) {
    const { data } = await supabase
      .from('highlights')
      .select('title, slug, cover_url, goal_amount, current_amount, currency')
      .in('id', broadcast.highlight_ids)
    projects = data ?? []
  }

  // Galeria e linha do tempo só existem pra broadcasts com `periodFrom`/
  // `periodTo` no snapshot (adicionado junto com este redesign) — sem essas
  // datas não dá pra saber que janela usar pra buscar posts/marcos do mesmo
  // período, então broadcasts antigos simplesmente não mostram essas seções
  // (sem quebrar, só voltam pro que já existia antes).
  let photos: PeriodPhoto[] = []
  let timelineItems: PeriodTimelineItem[] = []

  if (financial?.periodFrom && financial?.periodTo) {
    const periodToEnd = `${financial.periodTo}T23:59:59`

    // Fotos "do próprio missionário, puxadas automaticamente do perfil":
    // nunca upload manual pra esta página — são os posts com imagem que ele
    // já publicou no perfil dentro da janela da prestação de contas (mesmo
    // filtro de moderação/rascunho da página pública do perfil).
    const { data: posts } = await supabase
      .from('posts')
      .select('content, media_urls, published_at')
      .eq('profile_id', broadcast.profile_id)
      .eq('is_draft', false)
      .neq('moderation_status', 'removed')
      .in('type', ['image', 'carousel'])
      .gte('published_at', financial.periodFrom)
      .lte('published_at', periodToEnd)
      .order('published_at', { ascending: false })
      .limit(8)

    photos = (posts ?? [])
      .flatMap((p) => p.media_urls.slice(0, 2).map((url: string) => ({ url, caption: p.content?.trim() || null })))
      .slice(0, 12)

    // Linha do tempo: só marcos já concluídos dentro do período — nunca a
    // descrição de um lançamento (ver decisão de privacidade do redesign).
    // RLS de `milestones` já permite leitura pública direta (mesmo padrão
    // usado em [username]/projetos/[slug]/page.tsx).
    const { data: milestones } = await supabase
      .from('milestones')
      .select('id, title, completed_at, highlights(title, slug, cover_url)')
      .eq('profile_id', broadcast.profile_id)
      .eq('is_completed', true)
      .gte('completed_at', financial.periodFrom)
      .lte('completed_at', periodToEnd)
      .order('completed_at', { ascending: true })
      .limit(10)

    const shortDateFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: '2-digit', month: 'long' })
    timelineItems = (milestones ?? []).map((m) => {
      const highlight = Array.isArray(m.highlights) ? m.highlights[0] : m.highlights
      return {
        id: m.id,
        title: m.title,
        dateLabel: shortDateFmt.format(new Date(m.completed_at as string)),
        projectTitle: highlight?.title ?? '',
        coverUrl: highlight?.cover_url ?? null,
        href: highlight?.slug ? `/${username}/projetos/${highlight.slug}` : `/${username}`,
      }
    })
  }

  const dateLabel = formatLongDate(broadcast.created_at, locale)
  const accent = profile.accent_color

  // A primeira moeda de arrecadação vira o "momento wrapped" (tile grande,
  // sozinha, fora da grade de 2 colunas). O resto (outras moedas de
  // arrecadação, gasto) fica pra baixo — só entra numa grade de 2 colunas
  // quando são 2 ou mais; com exatamente 1 (o caso mais comum: 1 moeda de
  // arrecadação + 1 de gasto), o tile sozinho numa `grid-cols-2` ficava
  // encostado à esquerda com um vão vazio do lado (usuário mandou print
  // reportando os cards "não alinhados").
  const incomeEntries = Object.entries(financial?.incomeByCurrency ?? {})
  const expenseEntries = Object.entries(financial?.expenseByCurrency ?? {})
  const heroIncome = incomeEntries[0] ?? null
  const secondaryTiles = [
    ...incomeEntries.slice(1).map(([currency, value]) => ({ key: `in-${currency}`, currency, value, variant: 'income' as const })),
    ...expenseEntries.map(([currency, value]) => ({ key: `out-${currency}`, currency, value, variant: 'expense' as const })),
  ]

  return (
    <div className="min-h-screen bg-muted/30 relative overflow-hidden">
      {/* Área de capa única (mesma altura pra cor e pra foto) — pensada
          exatamente como a capa de um perfil de rede social: preenchida
          sólida até uma borda definida, nunca desvanecendo em cima do
          fundo da página (uma versão anterior fazia isso com `maskImage`
          e o usuário achou "melhor, mas" — preferiu a borda nítida, mesmo
          padrão de Twitter/Instagram/Facebook). Quando o missionário tiver
          uma foto de capa no perfil (`profile.cover_url`), ela passa a
          preencher automaticamente essa mesma área — nada muda de
          tamanho/posição, só troca cor sólida por `object-cover`. */}
      <div className="absolute inset-x-0 top-0 h-40 pointer-events-none overflow-hidden">
        {profile.cover_url ? (
          <Image src={profile.cover_url} alt="" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}66)` }} />
        )}
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 0%, ${accent}22, transparent 70%)` }} />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-8 space-y-6">
        <Reveal className="space-y-6">
          <RevealItem className="inline-flex items-center gap-3 bg-background/80 backdrop-blur-sm rounded-2xl px-3 py-2">
            {/* Chip translúcido em vez de texto solto sobre o gradiente/
                capa: `text-muted-foreground` é um cinza de baixo contraste
                pensado pra sentar sobre card claro — direto sobre a faixa
                de cor (ou uma foto de capa qualquer), a data ficava quase
                ilegível (usuário mandou print). Um fundo controlado atrás
                do texto garante contraste sempre, sem precisar adivinhar o
                quão clara/escura é a `accent_color` de cada missionário. */}
            <Avatar className="h-11 w-11 ring-4 ring-background shadow-sm">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
              <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{profile.display_name}</p>
              <p className="text-xs text-muted-foreground">{t('updateOf', { date: dateLabel })}</p>
            </div>
          </RevealItem>

          <RevealItem className="bg-card border rounded-2xl p-5">
            <h1 className="font-semibold text-lg mb-3">{broadcast.subject}</h1>
            <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{broadcast.body}</div>
          </RevealItem>

          {financial && canSeeExactFinancial && (
            <RevealItem className="space-y-3">
              {heroIncome && (
                <BroadcastStatTile value={heroIncome[1]} currency={heroIncome[0]} variant="income" size="lg" trend={trend} />
              )}
              {secondaryTiles.length > 0 && (
                <div className={`grid gap-3 ${secondaryTiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {secondaryTiles.map((tile) => (
                    <BroadcastStatTile key={tile.key} value={tile.value} currency={tile.currency} variant={tile.variant} />
                  ))}
                </div>
              )}
            </RevealItem>
          )}

          {categoryItems.length > 0 && (
            <RevealItem>
              <BroadcastCategoryChart
                items={categoryItems}
                currency={Object.keys(financial?.expenseByCurrency ?? {})[0] ?? 'BRL'}
                heading={t('categoryChartHeading')}
                footnote={canSeeExactFinancial ? undefined : t('categoryChartFootnote', { name: profile.display_name })}
              />
            </RevealItem>
          )}
        </Reveal>

        {photos.length > 0 && (
          <Reveal onScroll>
            <RevealItem>
              <BroadcastPhotoGallery photos={photos} heading={t('photosHeading')} />
            </RevealItem>
          </Reveal>
        )}

        {timelineItems.length > 0 && (
          <Reveal onScroll>
            <RevealItem>
              <BroadcastPeriodTimeline items={timelineItems} heading={t('timelineHeading')} />
            </RevealItem>
          </Reveal>
        )}

        {projects.length > 0 && (
          <Reveal onScroll className="space-y-3">
            <RevealItem className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('projectsHeading')}
            </RevealItem>
            {projects.map((p) => (
              <RevealItem key={p.slug ?? p.title}>
                <BroadcastProjectCard project={p} username={username} accent={accent} />
              </RevealItem>
            ))}
          </Reveal>
        )}

        <Reveal onScroll>
          {/* Antes a página terminava num texto estático, sem próximo
              passo (crítica do usuário: "beco sem saída") — link real pro
              perfil, reaproveitando uma rota que já existe. */}
          <RevealItem className="text-center pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('sentWithLove', { name: profile.display_name })}</p>
            <Link
              href={`/${username}`}
              className="inline-block text-xs font-semibold text-white px-4 py-2 rounded-lg"
              style={{ background: accent }}
            >
              {t('viewProfileCta', { name: profile.display_name })}
            </Link>
          </RevealItem>
        </Reveal>
      </div>
    </div>
  )
}
