import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { FinancialAccount, Transaction } from '@/types/database'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  accounts: FinancialAccount[]
  monthTransactions: Transaction[]
}

export function BalanceSummary({ accounts, monthTransactions }: Props) {
  const byCurrency = new Map<string, number>()
  for (const acc of accounts) {
    byCurrency.set(acc.currency_code, (byCurrency.get(acc.currency_code) ?? 0) + acc.balance)
  }

  const income = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const mainCurrency = accounts[0]?.currency_code ?? 'BRL'

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <Wallet className="h-4 w-4" /> Saldo total
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {byCurrency.size === 0 && <p className="text-lg font-semibold">{formatCurrency(0, mainCurrency)}</p>}
          {[...byCurrency.entries()].map(([currency, total]) => (
            <p key={currency} className="text-lg font-semibold">{formatCurrency(total, currency)}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <TrendingUp className="h-4 w-4 text-green-600" /> Entradas no mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-green-600">{formatCurrency(income, mainCurrency)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <TrendingDown className="h-4 w-4 text-red-600" /> Saídas no mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-red-600">{formatCurrency(expense, mainCurrency)}</p>
        </CardContent>
      </Card>
    </div>
  )
}
