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
}

export function AccountCard({ account, profileId, members }: Props) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{account.name}</p>
            <p className="text-xs text-muted-foreground">{TYPE_LABEL[account.account_type]} · {account.currency_code}</p>
          </div>
          {account.is_shared && <Badge variant="secondary">Compartilhada</Badge>}
        </div>
        <p className="text-2xl font-semibold">{formatCurrency(account.balance, account.currency_code)}</p>
        <div className="flex gap-2 pt-1">
          <AccountForm profileId={profileId} account={account} />
          {account.is_shared && <ManageMembersDialog accountId={account.id} members={members} />}
        </div>
      </CardContent>
    </Card>
  )
}
