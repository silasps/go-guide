import { Transaction } from '@/types/database'

export interface TimelinePoint {
  month: string // 'YYYY-MM'
  monthLabel: string // 'Setembro' ou "Janeiro '27" quando o ano difere do atual
  income: number
  expense: number
  incomeReceived: number
  incomePending: number
  expensePaid: number
  expenseUnpaid: number
  fixedIncome: number
  fixedExpense: number
  netCashFlow: number
  saldoAnterior: number
  saldoDisponivel: number
  saldoPrevisto: number
}

export type TimelineMetric = 'saldo_previsto' | 'fluxo' | 'despesas' | 'despesas_fixas' | 'receitas' | 'receitas_fixas'

export const TIMELINE_METRICS: { value: TimelineMetric; label: string }[] = [
  { value: 'saldo_previsto', label: 'Saldo previsto' },
  { value: 'fluxo', label: 'Despesas e receitas' },
  { value: 'despesas', label: 'Despesas' },
  { value: 'despesas_fixas', label: 'Despesas fixas' },
  { value: 'receitas', label: 'Receitas' },
  { value: 'receitas_fixas', label: 'Receitas fixas' },
]

export function metricValue(point: TimelinePoint, metric: TimelineMetric): number {
  switch (metric) {
    case 'saldo_previsto': return point.saldoPrevisto
    case 'fluxo': return point.netCashFlow
    case 'despesas': return point.expense
    case 'despesas_fixas': return point.fixedExpense
    case 'receitas': return point.income
    case 'receitas_fixas': return point.fixedIncome
  }
}

function monthLabelFor(date: Date, currentYear: number) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long' })
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
  return date.getFullYear() === currentYear ? capitalized : `${capitalized} '${String(date.getFullYear()).slice(2)}`
}

// Linha do tempo mensal com saldo projetado (modelo GranaZen — ver
// system.architecture.md 7.19). `currentBalance` é o saldo real da(s)
// conta(s) AGORA (soma de `financial_accounts.balance`, que só reflete
// transações `is_paid=true`, seja qual for a data). A partir dele, a
// função "desfaz" o efeito pago das transações dentro da janela pra achar
// o saldo de antes do primeiro mês, e depois caminha mês a mês pra frente
// — não precisa buscar histórico anterior à janela, o saldo atual já
// carrega esse efeito embutido.
export function buildFinancialTimeline(
  transactions: Transaction[],
  currentBalance: number,
  monthsBack: number,
  monthsForward: number
): TimelinePoint[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const windowStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const windowEndExclusive = new Date(now.getFullYear(), now.getMonth() + monthsForward + 1, 1)

  let paidNetWithinWindow = 0
  for (const t of transactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue
    if (!t.is_paid) continue
    const d = new Date(`${t.date}T00:00:00`)
    if (d < windowStart || d >= windowEndExclusive) continue
    paidNetWithinWindow += t.type === 'income' ? t.amount : -t.amount
  }
  let running = currentBalance - paidNetWithinWindow

  const points: TimelinePoint[] = []
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    let incomeReceived = 0, incomePending = 0, expensePaid = 0, expenseUnpaid = 0, fixedIncome = 0, fixedExpense = 0
    for (const t of transactions) {
      if (t.type !== 'income' && t.type !== 'expense') continue
      if (t.date.slice(0, 7) !== month) continue
      if (t.type === 'income') {
        if (t.is_paid) incomeReceived += t.amount; else incomePending += t.amount
        if (t.source === 'recurring') fixedIncome += t.amount
      } else {
        if (t.is_paid) expensePaid += t.amount; else expenseUnpaid += t.amount
        if (t.source === 'recurring') fixedExpense += t.amount
      }
    }

    const income = incomeReceived + incomePending
    const expense = expensePaid + expenseUnpaid
    const saldoAnterior = running
    const saldoDisponivel = saldoAnterior + incomeReceived - expensePaid
    const saldoPrevisto = saldoDisponivel + incomePending - expenseUnpaid
    running = saldoDisponivel

    points.push({
      month,
      monthLabel: monthLabelFor(d, currentYear),
      income,
      expense,
      incomeReceived,
      incomePending,
      expensePaid,
      expenseUnpaid,
      fixedIncome,
      fixedExpense,
      netCashFlow: income - expense,
      saldoAnterior,
      saldoDisponivel,
      saldoPrevisto,
    })
  }

  return points
}
