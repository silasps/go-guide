'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PledgeForm } from './pledge-form'
import { RecurringPledgeForm } from './recurring-pledge-form'
import { PartnershipForm } from './partnership-form'
import { PledgePaymentMethod } from '@/types/database'

type Choice = 'financial_once' | 'financial_once_general' | 'financial_ongoing' | 'prayer' | 'ambassador' | 'volunteer'

interface SessionUser {
  id: string
  email: string | null
  user_metadata?: { full_name?: string }
}

interface Props {
  profileId: string
  username: string
  initialChoice?: Choice
  missionaryName: string
  missionStartYear: number | null
  highlightId?: string
  highlightTitle?: string
  currency: string
  paymentOptions: { method: PledgePaymentMethod; label: string; value: string }[]
  hasFinancialOptions: boolean
  stripeAvailable: boolean
  user: SessionUser | null
}

export function PartnershipWizard({ profileId, username, initialChoice, missionaryName, missionStartYear, highlightId, highlightTitle, currency, paymentOptions, hasFinancialOptions, stripeAvailable, user }: Props) {
  const [choice, setChoice] = useState<Choice | null>(initialChoice ?? null)

  if (choice === 'financial_once' || choice === 'financial_once_general') {
    return (
      <div className="space-y-3">
        <button onClick={() => setChoice(null)} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
        <PledgeForm
          key={choice}
          profileId={profileId}
          missionaryName={missionaryName}
          highlightId={choice === 'financial_once' ? highlightId : undefined}
          highlightTitle={choice === 'financial_once' ? highlightTitle : undefined}
          isRecurring={false}
          currency={currency}
          paymentOptions={paymentOptions}
          onBecomePartner={() => setChoice('financial_ongoing')}
        />
      </div>
    )
  }

  if (choice === 'financial_ongoing') {
    const returnPath = `/${username}/parceria${highlightId ? `?highlight_id=${highlightId}` : ''}`
    return (
      <div className="space-y-3">
        <button onClick={() => setChoice(null)} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
        <RecurringPledgeForm
          profileId={profileId}
          missionaryName={missionaryName}
          currency={currency}
          paymentOptions={paymentOptions}
          stripeAvailable={stripeAvailable}
          user={user}
          returnPath={returnPath}
          highlightId={highlightId}
        />
      </div>
    )
  }

  if (choice === 'prayer' || choice === 'ambassador' || choice === 'volunteer') {
    const typeMap = { prayer: 'prayer', ambassador: 'ambassador', volunteer: 'both' } as const
    return (
      <div className="space-y-3">
        <button onClick={() => setChoice(null)} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
        <PartnershipForm profileId={profileId} missionaryName={missionaryName} defaultType={typeMap[choice]} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Link href={`/${username}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Voltar ao perfil de {missionaryName}
      </Link>
      {hasFinancialOptions && highlightId && (
        <button
          type="button"
          onClick={() => setChoice('financial_once')}
          className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl shrink-0">💰</span>
          <div>
            <p className="font-medium text-sm">Apoiar {highlightTitle ?? 'este projeto'}</p>
            <p className="text-xs text-muted-foreground">Uma oferta pontual para esta campanha específica</p>
          </div>
        </button>
      )}
      {hasFinancialOptions && (
        <button
          type="button"
          onClick={() => setChoice('financial_once_general')}
          className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl shrink-0">🎁</span>
          <div>
            <p className="font-medium text-sm">Fazer uma doação única</p>
            <p className="text-xs text-muted-foreground">Uma contribuição pontual, sem compromisso de continuidade</p>
          </div>
        </button>
      )}
      {hasFinancialOptions && (
        <button
          type="button"
          onClick={() => setChoice('financial_ongoing')}
          className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl shrink-0">🔄</span>
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
        onClick={() => setChoice('prayer')}
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
        onClick={() => setChoice('ambassador')}
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
        onClick={() => setChoice('volunteer')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-2xl shrink-0">🤝</span>
        <div>
          <p className="font-medium text-sm">Oferecer apoio pessoal</p>
          <p className="text-xs text-muted-foreground">Voluntariado, habilidades ou outro tipo de ajuda</p>
        </div>
      </button>
    </div>
  )
}
