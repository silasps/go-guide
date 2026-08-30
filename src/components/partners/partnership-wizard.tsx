'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PledgeForm } from './pledge-form'
import { RecurringPledgeForm } from './recurring-pledge-form'
import { PartnershipForm } from './partnership-form'
import { PledgePaymentMethod } from '@/types/database'
import type { BudgetCategoryOption } from './budget-category-select'
import { CheckoutHeader } from './checkout-header'

type Choice = 'financial_once' | 'financial_once_general' | 'financial_ongoing' | 'prayer' | 'ambassador' | 'volunteer'

interface SessionUser {
  id: string
  email: string | null
  user_metadata?: { full_name?: string }
  phone?: string | null
  whatsappOptIn?: boolean
}

export interface PartnershipWizardProps {
  profileId: string
  username: string
  initialChoice?: Choice
  missionaryName: string
  missionStartYear: number | null
  highlightId?: string
  highlightTitle?: string
  defaultCurrency: string
  paymentOptions: { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }[]
  budgetCategories?: BudgetCategoryOption[]
  initialCategoryId?: string | null
  hasFinancialOptions: boolean
  stripeAvailable: boolean
  profileAvatarUrl: string | null
  highlightCoverUrl?: string | null
  highlightCoverPosition?: string | null
  user: SessionUser | null
}

export function PartnershipWizard({ profileId, username, initialChoice, missionaryName, missionStartYear, highlightId, highlightTitle, defaultCurrency, paymentOptions, budgetCategories, initialCategoryId, hasFinancialOptions, stripeAvailable, profileAvatarUrl, highlightCoverUrl, highlightCoverPosition, user }: PartnershipWizardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // `choice` vem direto da URL (nunca de state próprio) — é a URL que manda,
  // não o contrário. Isso é o que faz `router.back()` funcionar direito: ao
  // escolher algo na lista, `goTo` empilha uma entrada de histórico de
  // verdade (`push`), então voltar (seta do CheckoutHeader, botão do
  // navegador, ou o botão "voltar" da própria página do Stripe Checkout)
  // sempre volta pra tela imediatamente anterior de verdade — seja a lista
  // do wizard (se foi por ela) ou a página de origem (projeto/perfil), se o
  // usuário chegou direto num link profundo (`?choice=financial_once`) sem
  // nunca ter visto a lista. Antes, `choice` era `useState` e "voltar"
  // sempre resetava pra lista via `setChoice(null)`, ignorando de onde o
  // usuário realmente veio (bug reportado pelo usuário).
  const choice = (searchParams.get('choice') as Choice | null) ?? initialChoice ?? null

  function goTo(next: Choice | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('choice', next)
    else params.delete('choice')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // Destino de segurança só usado quando não há histórico de navegação real
  // pra voltar (ex.: aba nova aberta direto num link profundo) — o clique
  // normal sempre prefere `router.back()` de verdade (ver BackButton).
  const listHref = `/${username}/parceria`

  if (choice === 'financial_once' || choice === 'financial_once_general') {
    return (
      <PledgeForm
        key={choice}
        profileId={profileId}
        missionaryName={missionaryName}
        highlightId={choice === 'financial_once' ? highlightId : undefined}
        highlightTitle={choice === 'financial_once' ? highlightTitle : undefined}
        isRecurring={false}
        defaultCurrency={defaultCurrency}
        paymentOptions={paymentOptions}
        stripeAvailable={stripeAvailable}
        heroImageUrl={choice === 'financial_once' ? (highlightCoverUrl ?? profileAvatarUrl) : profileAvatarUrl}
        heroImagePosition={choice === 'financial_once' && highlightCoverUrl ? (highlightCoverPosition ?? undefined) : undefined}
        budgetCategories={choice === 'financial_once' ? budgetCategories : undefined}
        initialCategoryId={choice === 'financial_once' ? initialCategoryId : undefined}
        backHref={listHref}
        onBecomePartner={() => goTo('financial_ongoing')}
      />
    )
  }

  if (choice === 'financial_ongoing') {
    const returnPath = `/${username}/parceria${highlightId ? `?highlight_id=${highlightId}` : ''}`
    return (
      <RecurringPledgeForm
        profileId={profileId}
        missionaryName={missionaryName}
        currency={defaultCurrency}
        paymentOptions={paymentOptions}
        stripeAvailable={stripeAvailable}
        heroImageUrl={highlightId ? (highlightCoverUrl ?? profileAvatarUrl) : profileAvatarUrl}
        heroImagePosition={highlightId && highlightCoverUrl ? (highlightCoverPosition ?? undefined) : undefined}
        backHref={listHref}
        user={user}
        returnPath={returnPath}
        highlightId={highlightId}
        budgetCategories={budgetCategories}
        initialCategoryId={initialCategoryId}
      />
    )
  }

  // Financial_once/financial_once_general/financial_ongoing (acima) montam sua
  // própria tela cheia (header/footer fixos) — as demais escolhas usam o cartão
  // centralizado tradicional, envolvido aqui.
  if (choice === 'prayer' || choice === 'ambassador' || choice === 'volunteer') {
    const typeMap = { prayer: 'prayer', ambassador: 'ambassador', volunteer: 'both' } as const
    return (
      <div className="min-h-screen bg-background">
        <CheckoutHeader backHref={listHref} />
        <div className="mx-auto max-w-md px-4 pt-[72px] pb-8">
          <PartnershipForm profileId={profileId} missionaryName={missionaryName} defaultType={typeMap[choice]} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CheckoutHeader backHref={`/${username}`} backLabel="Voltar ao perfil" />
      <div className="mx-auto max-w-md px-4 pt-[72px] pb-8">
      <div className="space-y-3">
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold">Faça parte com {missionaryName}</h1>
        <p className="text-muted-foreground mt-2">Escolha como você quer se envolver com esta missão.</p>
      </div>
      {hasFinancialOptions && highlightId && (
        <button
          type="button"
          onClick={() => goTo('financial_once')}
          className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl shrink-0 h-10 w-10 rounded-full bg-support/10 flex items-center justify-center">💰</span>
          <div>
            <p className="font-medium text-sm">Apoiar {highlightTitle ?? 'este projeto'}</p>
            <p className="text-xs text-muted-foreground">Uma oferta pontual para esta campanha específica</p>
          </div>
        </button>
      )}
      {hasFinancialOptions && (
        <button
          type="button"
          onClick={() => goTo('financial_once_general')}
          className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl shrink-0 h-10 w-10 rounded-full bg-support/10 flex items-center justify-center">🎁</span>
          <div>
            <p className="font-medium text-sm">Fazer uma doação única</p>
            <p className="text-xs text-muted-foreground">Uma contribuição pontual, sem compromisso de continuidade</p>
          </div>
        </button>
      )}
      {hasFinancialOptions && (
        <button
          type="button"
          onClick={() => goTo('financial_ongoing')}
          className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl shrink-0 h-10 w-10 rounded-full bg-support/10 flex items-center justify-center">🔄</span>
          <div>
            <p className="font-medium text-sm">Ser parceiro fixo da missão</p>
            <p className="text-xs text-muted-foreground">
              Faça parte do que o Senhor está fazendo através da vida de {missionaryName}
              {missionStartYear ? ` desde ${missionStartYear}` : ''}.
            </p>
          </div>
        </button>
      )}
      <button
        type="button"
        onClick={() => goTo('prayer')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-2xl shrink-0">🙏</span>
        <div>
          <p className="font-medium text-sm">Comprometer-me em oração</p>
          <p className="text-xs text-muted-foreground">Orar regularmente por esta missão</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => goTo('ambassador')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-2xl shrink-0">📣</span>
        <div>
          <p className="font-medium text-sm">Divulgar e trazer apoiadores</p>
          <p className="text-xs text-muted-foreground">Compartilhar com sua rede e ajudar a missão a crescer</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => goTo('volunteer')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-2xl shrink-0">🤝</span>
        <div>
          <p className="font-medium text-sm">Oferecer apoio pessoal</p>
          <p className="text-xs text-muted-foreground">Voluntariado, habilidades ou outro tipo de ajuda</p>
        </div>
      </button>
      </div>
      </div>
    </div>
  )
}
