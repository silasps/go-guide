import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { FinancialAccount } from '@/types/database'
import { AccountForm } from './account-form'
import { ManageMembersDialog } from './manage-members-dialog'

const TYPE_LABEL: Record<string, string> = { checking: 'Conta corrente', savings: 'Poupança', credit: 'Cartão de crédito' }

interface Props {
  account: FinancialAccount
  profileId: string
  members: { id: string; user_id: string; role: string }[]
  currentBill?: number
}

export function AccountCard({ account, profileId, members, currentBill = 0 }: Props) {
  const isCredit = account.account_type === 'credit'
  const bill = Math.max(0, currentBill)
  const available = account.credit_limit != null ? account.credit_limit - bill : null
  const usedPct = account.credit_limit ? Math.min((bill / account.credit_limit) * 100, 100) : 0

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{account.name}</p>
            <p className="text-xs text-muted-foreground">
              {TYPE_LABEL[account.account_type]} · {account.currency_code}{account.card_brand ? ` · ${account.card_brand}` : ''}
            </p>
          </div>
          {account.is_shared && <Badge variant="secondary">Compartilhada</Badge>}
        </div>

        {isCredit ? (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Fatura atual</p>
              <p className="text-2xl font-semibold">{formatCurrency(bill, account.currency_code)}</p>
            </div>
            {account.credit_limit != null && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usedPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Disponível: {formatCurrency(available ?? 0, account.currency_code)}</span>
                  <span>Limite: {formatCurrency(account.credit_limit, account.currency_code)}</span>
                </div>
              </>
            )}
            {(account.closing_day || account.due_day) && (
              <p className="text-xs text-muted-foreground">
                {account.closing_day && `Fecha dia ${account.closing_day}`}
                {account.closing_day && account.due_day && ' · '}
                {account.due_day && `Vence dia ${account.due_day}`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-2xl font-semibold">{formatCurrency(account.balance, account.currency_code)}</p>
        )}

        <div className="flex gap-2 pt-1">
          <AccountForm profileId={profileId} account={account} />
          {account.is_shared && <ManageMembersDialog accountId={account.id} members={members} />}
        </div>
      </CardContent>
    </Card>
  )
}
