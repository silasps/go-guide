import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import Image from 'next/image'
import { InstagramVideoPlayer } from '@/components/shared/instagram-video-player'
import { coverThumbnailSrc } from '@/lib/media/bunny-thumbnail'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatCurrency, getInitials } from '@/lib/utils'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import type { Locale } from '@/i18n/config'
import { CheckCircle2, Circle, QrCode, Users } from 'lucide-react'
import { BudgetBreakdown } from '@/components/highlights/budget-breakdown'
import { FundingProjectionCard } from '@/components/highlights/funding-projection-card'
import type { PaymentMethodType, PostWithProfile } from '@/types/database'
import { enrichWithEngagement } from '@/lib/posts/enrich-with-engagement'
import { ProfilePostsGrid } from '@/components/shared/profile-posts-grid'
import { PostComposerProvider } from '@/components/dashboard/post-composer-provider'
import { ProjectComposerProvider } from '@/components/highlights/project-composer/project-composer-provider'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import { CopyableValue } from '@/components/partners/payment-method-instructions'
import { CoverTitleEditSection } from '@/components/highlights/cover-title-edit-section'
import { DescriptionEditSection } from '@/components/highlights/description-edit-section'
import { SupportTypesEditSection } from '@/components/highlights/support-types-edit-section'
import { FinancialEditSection } from '@/components/highlights/financial-edit-section'
import { MilestonesEditSection } from '@/components/highlights/milestones-edit-section'
import { GalleryEditSection } from '@/components/highlights/gallery-edit-section'
import { ProjectCoverFallback } from '@/components/highlights/project-cover-fallback'
import { FloatingSupportCta } from '@/components/highlights/floating-support-cta'
import { ScrollToSectionLink } from '@/components/highlights/scroll-to-section-link'
import { LetterEditSection } from '@/components/highlights/letter-edit-section'
import { DatesStatusEditSection } from '@/components/highlights/dates-status-edit-section'
import { StatusBadge } from '@/components/highlights/status-badge'
import type { HighlightSnapshot } from '@/components/highlights/section-types'
import { getProfile } from '@/lib/profile/get-profile'
import { ShareButton } from '@/components/shared/share-button'

// Mesmo padrão de src/app/layout.tsx — necessário aqui pra montar uma URL
// absoluta de compartilhamento num Server Component (sem window.location).
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://mission-guide.vercel.app'

interface Props {
  params: Promise<{ username: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params
  const supabase = await createClient()

  const profile = await getProfile(username)

  if (!profile) return { title: 'Projeto não encontrado' }

  const { data: project } = await supabase
    .from('highlights')
    .select('title, description, cover_url')
    .eq('profile_id', profile.id)
    .eq('slug', slug)
    .single()

  if (!project) return { title: 'Projeto não encontrado' }

  const isIndexable = profile.privacy_mode === 'public'

  return {
    title: `${project.title} — ${profile.display_name}`,
    description: project.description ?? undefined,
    openGraph: isIndexable ? {
      title: project.title,
      description: project.description ?? '',
      images: project.cover_url ? [project.cover_url] : [],
    } : undefined,
    robots: isIndexable ? undefined : { index: false, follow: false },
  }
}

const SUPPORT_TYPES = [
  {
    key: 'financial',
    choice: 'financial_once',
    icon: '💰',
    title: 'Apoio financeiro',
    description: 'Faça uma oferta pontual ou seja parceiro fixo',
    cta: 'Faça parte',
  },
  {
    key: 'prayer',
    choice: 'prayer',
    icon: '🙏',
    title: 'Oração',
    description: 'Comprometa-se a orar regularmente por este projeto',
    cta: 'Comprometer-me em oração',
  },
  {
    key: 'volunteer',
    choice: 'volunteer',
    icon: '🤝',
    title: 'Voluntário',
    description: 'Ofereça apoio pessoal ou com suas habilidades',
    cta: 'Oferecer minha ajuda',
  },
  {
    key: 'ongoing',
    choice: 'financial_ongoing',
    icon: '🔄',
    title: 'Parceria contínua',
    description: 'Acompanhe esta missão no longo prazo',
    cta: 'Ser parceiro de longo prazo',
  },
]

export default async function ProjetoPublicoPage({ params }: Props) {
  const { username, slug } = await params
  const profile = await getProfile(username)

  if (!profile) notFound()
  if (profile.privacy_mode === 'stealth') notFound()

  const supabase = await createClient()
  const { canEdit, viewerUserId } = await getProfileViewerContext(username)

  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('sort_order')
  const pixMethod = (paymentMethods ?? []).find(m => m.type === 'pix')
  const linkPriority: PaymentMethodType[] = ['other', 'paypal', 'wise', 'bank_transfer']
  const linkMethod = linkPriority
    .map(type => (paymentMethods ?? []).find(m => m.type === type))
    .find(Boolean)

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  let projectQuery = supabase.from('highlights').select('*').eq('profile_id', profile.id)
  if (!canEdit) projectQuery = projectQuery.eq('status', 'active')
  const { data: project } = await (isUUID
    ? projectQuery.or(`slug.eq.${slug},id.eq.${slug}`)
    : projectQuery.eq('slug', slug)
  ).single()

  if (!project) notFound()

  const visitorLocale = (await getLocale()) as Locale
  const localizedTitle = resolveLocalizedText(project.title, project.original_locale, project.title_translations, visitorLocale).text ?? project.title
  const localizedDescription = resolveLocalizedText(project.description, project.original_locale, project.description_translations, visitorLocale).text
  const localizedScripture = resolveLocalizedText(project.scripture, project.original_locale, project.scripture_translations, visitorLocale).text
  const localizedLetter = resolveLocalizedText(project.letter, project.original_locale, project.letter_translations, visitorLocale).text

  const [{ data: milestones }, { data: updates }, { data: budgetCategories }, { data: galleryImages }, { data: pastProjects }, { count: supporterCount }] = await Promise.all([
    supabase.from('milestones').select('*').eq('highlight_id', project.id).order('order_index'),
    supabase.from('posts').select('*')
      .eq('profile_id', profile.id).eq('project_id', project.id).eq('is_draft', false)
      .order('published_at', { ascending: false }).limit(12),
    supabase.from('project_budget_progress').select('*').eq('highlight_id', project.id).order('order_index'),
    supabase.from('project_gallery_images').select('*').eq('highlight_id', project.id).order('order_index'),
    supabase.from('highlights').select('id, slug, title, cover_url, cover_position, category, original_locale, title_translations')
      .eq('profile_id', profile.id).eq('status', 'completed').neq('id', project.id)
      .order('completed_at', { ascending: false }).limit(3),
    supabase.from('pledges').select('reporter_user_id, reporter_email', { count: 'exact', head: true })
      .eq('highlight_id', project.id).eq('status', 'confirmed'),
  ])

  // Posts vinculados a este projeto (`project_id`) já tinham o caminho de ida
  // (post -> projeto), mas nenhum de volta — mesmos dados/engajamento do
  // grid de posts do perfil (`[username]/page.tsx`), reaproveitando
  // `ProfilePostsGrid`/`PostDetailViewer` em vez de inventar outra grade.
  const { data: { user } } = await supabase.auth.getUser()
  const updatesEngagement = updates && updates.length > 0
    ? await enrichWithEngagement(supabase, updates.map(u => u.id), user?.id)
    : new Map()
  const updatesWithProfile = (updates ?? []).map(u => ({
    ...u,
    profile: { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, accent_color: profile.accent_color },
    ...updatesEngagement.get(u.id)!,
  })) as unknown as PostWithProfile[]

  const types: string[] = Array.isArray(project.goal_type) ? project.goal_type : [project.goal_type]
  const pct = project.goal_amount
    ? Math.min(100, (project.current_amount / project.goal_amount) * 100)
    : null

  const donationLink = linkMethod?.value || null
  const hasFinancial = types.includes('financial')
  const completedCount = milestones?.filter(m => m.is_completed).length ?? 0
  const totalMilestones = milestones?.length ?? 0
  const localizedMilestones = (milestones ?? []).map(m => ({
    ...m,
    localizedTitle: resolveLocalizedText(m.title, project.original_locale, m.title_translations, visitorLocale).text ?? m.title,
  }))

  const activeSupportTypes = SUPPORT_TYPES.filter(t => {
    if (!types.includes(t.key)) return false
    if (t.key === 'financial' && !donationLink && !pixMethod) return false
    return true
  })

  const snapshot: HighlightSnapshot = {
    originalLocale: project.original_locale,
    title: project.title,
    titleTranslations: project.title_translations ?? {},
    description: project.description ?? '',
    descriptionTranslations: project.description_translations ?? {},
    goalTypes: types,
    category: project.category ?? [],
    goalAmount: project.goal_amount,
    currentAmount: project.current_amount,
    currency: project.currency,
    coverUrl: project.cover_url,
    coverPosition: project.cover_position,
    coverMediaType: project.cover_media_type,
    coverStatus: project.cover_status,
    coverBunnyVideoId: project.cover_bunny_video_id,
    tripStartDate: project.trip_start_date,
    fundingDeadline: project.funding_deadline,
    scripture: project.scripture ?? '',
    scriptureTranslations: project.scripture_translations ?? {},
    letter: project.letter ?? '',
    letterTranslations: project.letter_translations ?? {},
    status: project.status,
    milestones: (milestones ?? []).map(m => ({ id: m.id, title: m.title, titleTranslations: m.title_translations ?? {}, is_completed: m.is_completed })),
    budgetCategories: (budgetCategories ?? []).map(b => ({ category_type: b.category_type, custom_label: b.custom_label, description: b.description, target_amount: b.target_amount })),
    galleryImages: (galleryImages ?? []).map(g => g.image_url),
  }
  const sectionProps = { canEdit, snapshot, highlightId: project.id, profileId: profile.id }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        <CoverTitleEditSection {...sectionProps}>
          <>
            {/* Hero: capa 16:9 + avatar sobreposto */}
            <div className="relative aspect-video rounded-2xl overflow-hidden">
              {project.cover_media_type === 'video' ? (
                <InstagramVideoPlayer src={project.cover_url ?? ''} status={project.cover_status} className="absolute inset-0" showFullscreenButton />
              ) : project.cover_url ? (
                <Image src={project.cover_url} alt={localizedTitle} fill className="object-cover" style={{ objectPosition: project.cover_position ?? '50% 50%' }} />
              ) : (
                <ProjectCoverFallback category={project.category} />
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full pr-3 py-1">
                <Avatar className="h-7 w-7 border-2 border-white/80">
                  <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
                  <AvatarFallback className="text-[10px]">{getInitials(profile.display_name)}</AvatarFallback>
                </Avatar>
                <span className="text-white text-xs font-medium">{profile.display_name}</span>
              </div>
            </div>

            {/* Cabeçalho */}
            <div className="space-y-3 mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-2xl font-bold flex-1 min-w-0">{localizedTitle}</h1>
                {/* Status precisa ficar visível E editável direto daqui —
                    não só dentro do formulário de edição de datas
                    (feedback direto do usuário). */}
                <StatusBadge {...sectionProps} />
                <ShareButton
                  iconOnly
                  variant="ghost"
                  url={`${SITE_URL}/${username}/projetos/${project.slug ?? project.id}`}
                  title={localizedTitle}
                  label="Compartilhar projeto"
                  copiedLabel="Link do projeto copiado"
                />
              </div>
              {localizedScripture && (
                <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">{localizedScripture}</p>
              )}
            </div>
          </>
        </CoverTitleEditSection>

        {(project.description || canEdit) && (
          <DescriptionEditSection {...sectionProps}>
            {localizedDescription
              ? <p className="text-muted-foreground">{localizedDescription}</p>
              : (canEdit ? <p className="text-sm text-muted-foreground italic">Adicionar descrição...</p> : null)}
          </DescriptionEditSection>
        )}

        {(project.letter || canEdit) && (
          <ScrollToSectionLink targetId="project-story" label="📖 Conheça a história por trás deste projeto" />
        )}

        {canEdit && (
          <SupportTypesEditSection {...sectionProps}>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORT_TYPES.filter(t => types.includes(t.key)).map(t => (
                <span key={t.key} className="text-xs px-2 py-1 rounded-full border text-muted-foreground">{t.icon} {t.title}</span>
              ))}
            </div>
          </SupportTypesEditSection>
        )}

        {/* Datas + apoiadores */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
          <DatesStatusEditSection {...sectionProps}>
            <>
              {project.trip_start_date && (
                <span className="px-2.5 py-1 rounded-full border">📅 Início em {new Date(project.trip_start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              )}
              {project.funding_deadline && (
                <span className="px-2.5 py-1 rounded-full border">⏳ Prazo: {new Date(project.funding_deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              )}
              {/* Sem isso, com as duas datas vazias o children fica sem
                  nenhum conteúdo — a caixinha que ancora o lápis de editar
                  (position: relative) encolhe a zero e o ícone (absolute)
                  fica "flutuando" solto no canto, sem card visível ao redor. */}
              {/* pr-7 reserva o espaço do lápis (absolute top-0 right-0,
                  h-7 w-7) — sem isso o texto passa por baixo do ícone. */}
              {!project.trip_start_date && !project.funding_deadline && canEdit && (
                <span className="italic pr-7">Adicionar datas...</span>
              )}
            </>
          </DatesStatusEditSection>
          {(supporterCount ?? 0) > 0 && (
            <span className="px-2.5 py-1 rounded-full border flex items-center gap-1"><Users className="h-3 w-3" /> {supporterCount} apoiador(es)</span>
          )}
        </div>

        {/* Bloco financeiro em destaque — só aparece quando relevante.
            Hierarquia: progresso geral em destaque → CTA geral → (se
            houver) apoio por área específica, cada uma com seu próprio
            "faltam" e botão de contribuir — pedido direto do usuário pra
            deixar isso mais organizado e fácil de agir. */}
        {hasFinancial && (
          <div id="financial-card" className="rounded-2xl border bg-card p-5 space-y-5">
            <FinancialEditSection {...sectionProps}>
              <>
                {project.goal_amount && pct !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-base">{formatCurrency(project.current_amount, project.currency)} arrecadados</span>
                      <span className="text-muted-foreground">Meta: {formatCurrency(project.goal_amount, project.currency)}</span>
                    </div>
                    <Progress value={pct} className="h-2.5" />
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% da meta atingida</p>
                      {pct >= 100 && <Badge variant="success" className="text-xs">Meta atingida 🎉</Badge>}
                    </div>
                  </div>
                )}

                {!canEdit && (
                  <Link href={`/${username}/parceria?highlight_id=${project.id}&choice=financial_once`} className={cn(buttonVariants({ variant: 'support', size: 'lg' }), 'w-full text-base')}>
                    💰 Apoiar este projeto
                  </Link>
                )}

                {budgetCategories && budgetCategories.length > 0 && (
                  <BudgetBreakdown
                    categories={budgetCategories}
                    currency={project.currency}
                    heading="Ou apoie uma área específica"
                    contributeBaseHref={canEdit ? undefined : `/${username}/parceria?highlight_id=${project.id}&choice=financial_once`}
                    contributeLabel="Contribuir"
                    missingLabel={(amount) => `Faltam ${amount}`}
                  />
                )}
              </>
            </FinancialEditSection>

            {pixMethod && (
              <div className="rounded-xl border border-support/40 bg-support/10 p-3 space-y-1.5">
                <p className="text-xs font-medium text-support text-center flex items-center justify-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" /> Chave PIX para transferência direta
                </p>
                {pixMethod.label && (
                  <p className="text-xs text-center text-muted-foreground">
                    Em nome de <span className="font-medium text-foreground">{pixMethod.label}</span>
                  </p>
                )}
                <CopyableValue value={pixMethod.value} emphasized />
              </div>
            )}
          </div>
        )}

        {hasFinancial && !canEdit && <FloatingSupportCta targetId="financial-card" />}

        {hasFinancial && project.status === 'active' && (
          <FundingProjectionCard
            raisedAmount={project.current_amount}
            goalAmount={project.goal_amount}
            currency={project.currency}
            createdAt={project.created_at}
            fundingDeadline={project.funding_deadline}
            tripStartDate={project.trip_start_date}
            contributeHref={canEdit ? undefined : `/${username}/parceria?highlight_id=${project.id}&choice=financial_once`}
          />
        )}

        {/* Outras formas de apoio */}
        {activeSupportTypes.filter(t => t.key !== 'financial').length > 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Outras formas de apoiar</h2>
            <div className="space-y-2">
              {activeSupportTypes.filter(t => t.key !== 'financial').map(t => (
                <Link
                  key={t.key}
                  href={`/${username}/parceria?highlight_id=${project.id}&choice=${t.choice}`}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 hidden sm:flex')}>
                    {t.cta}
                  </span>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 sm:hidden')}>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Se não tem financeiro, mostra todos os tipos como cards */}
        {!hasFinancial && activeSupportTypes.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Como apoiar</h2>
            <div className="space-y-2">
              {activeSupportTypes.map(t => (
                <Link
                  key={t.key}
                  href={`/${username}/parceria?highlight_id=${project.id}&choice=${t.choice}`}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 hidden sm:flex')}>
                    {t.cta}
                  </span>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 sm:hidden')}>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Marcos */}
        {(totalMilestones > 0 || canEdit) && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Marcos</h2>
              {totalMilestones > 0 && <span className="text-sm text-muted-foreground">{completedCount}/{totalMilestones} concluídos</span>}
            </div>
            <MilestonesEditSection {...sectionProps}>
              {totalMilestones > 0 ? (
                <ul className="space-y-2">
                  {localizedMilestones.map(m => (
                    <li key={m.id} className="flex items-center gap-2.5 text-sm">
                      {m.is_completed
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                      <span className={m.is_completed ? 'text-muted-foreground line-through' : ''}>{m.localizedTitle}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                canEdit ? <p className="text-sm text-muted-foreground italic">Nenhum marco ainda.</p> : null
              )}
            </MilestonesEditSection>
          </div>
        )}

        {/* Galeria — fotos avulsas que representam o projeto, separadas da
            capa única e dos posts vinculados (que aparecem em "Atualizações"). */}
        {(snapshot.galleryImages.length > 0 || canEdit) && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Fotos do projeto</h2>
            <GalleryEditSection {...sectionProps}>
              {snapshot.galleryImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {snapshot.galleryImages.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                      <Image src={url} alt="" fill sizes="33vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                canEdit ? <p className="text-sm text-muted-foreground italic">Nenhuma foto ainda.</p> : null
              )}
            </GalleryEditSection>
          </div>
        )}

        {/* História por trás */}
        {(project.letter || canEdit) && (
          <div id="project-story" className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold">A história por trás deste projeto</h2>
            <LetterEditSection {...sectionProps}>
              {localizedLetter ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {localizedLetter.split('\n').filter((l: string) => l.trim()).map((para: string, i: number) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground/80 mb-3">{para}</p>
                  ))}
                </div>
              ) : (
                canEdit ? <p className="text-sm text-muted-foreground italic">Adicionar história...</p> : null
              )}
            </LetterEditSection>
          </div>
        )}

        {/* Atualizações — posts vinculados a este projeto (caminho de volta).
            Cartão sem padding horizontal (`overflow-hidden` em vez de `p-5`)
            porque `ProfilePostsGrid` usa `-mx-4` pra sangrar a grade até a
            borda contra o `px-4` da página — com `p-5` uniforme ela vazaria
            alguns pixels pra fora dos cantos arredondados do cartão. Em vez
            disso, o `px-4` fica só no wrapper direto da grade, cancelado
            pelo mesmo `-mx-4`, e a grade sangra até a borda do cartão (que
            corta os cantos com `overflow-hidden`) — mesmo efeito visual do
            grid do perfil, só que dentro do cartão. */}
        {updatesWithProfile.length > 0 && (
          <div className="rounded-2xl border bg-card overflow-hidden">
            <h2 className="font-semibold p-5 pb-3">Atualizações</h2>
            <div className="px-4">
              {canEdit && viewerUserId ? (
                <ProjectComposerProvider profileId={profile.id}>
                  <PostComposerProvider
                    profileId={profile.id}
                    userId={viewerUserId}
                    displayName={profile.display_name}
                    avatarUrl={profile.avatar_url}
                    originalLocale={profile.locale}
                  >
                    <ProfilePostsGrid posts={updatesWithProfile} visitorLocale={visitorLocale} canEdit={canEdit} />
                  </PostComposerProvider>
                </ProjectComposerProvider>
              ) : (
                <ProfilePostsGrid posts={updatesWithProfile} visitorLocale={visitorLocale} canEdit={canEdit} />
              )}
            </div>
          </div>
        )}

        {/* Projetos anteriores do mesmo missionário */}
        {pastProjects && pastProjects.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Trajetória de {profile.display_name}</h2>
              <Link href={`/${username}/trajetoria`} className="text-xs text-primary hover:underline">Ver tudo</Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {pastProjects.map(p => {
                const pTitle = resolveLocalizedText(p.title, p.original_locale, p.title_translations, visitorLocale).text ?? p.title
                return (
                  <Link key={p.id} href={`/${username}/projetos/${p.slug ?? p.id}`} className="space-y-1.5 group">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                      {p.cover_url ? (
                        <Image src={coverThumbnailSrc(p.cover_url)} alt={pTitle} fill className="object-cover group-hover:scale-105 transition-transform" style={{ objectPosition: p.cover_position ?? '50% 50%' }} />
                      ) : (
                        <ProjectCoverFallback category={p.category} />
                      )}
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{pTitle}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
