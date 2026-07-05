import { Pledge, FinancialAccount } from '@/types/database'
import { PledgeReviewCard } from './pledge-review-card'

interface Props {
  pledges: (Pledge & { highlight?: { title: string } | null })[]
  accounts: FinancialAccount[]
  profileId: string
}

export function ReconciliationQueue({ pledges, accounts, profileId }: Props) {
  if (pledges.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma oferta pendente de confirmação.</p>
  }

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Crie uma conta financeira antes de confirmar ofertas.</p>
  }

  return (
    <div className="space-y-3">
      {pledges.map(p => (
        <PledgeReviewCard key={p.id} pledge={p} accounts={accounts} profileId={profileId} />
      ))}
    </div>
  )
}
