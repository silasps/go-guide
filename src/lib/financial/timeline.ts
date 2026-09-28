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
  saldoAnterior: number | null
  saldoDisponivel: number | null
  saldoPrevisto: number | null
}

export type TimelineMetric = 'saldo_previsto' | 'fluxo' | 'despesas' | 'despesas_fixas' | 'receitas' | 'receitas_fixas'

export const TIMELINE_METRICS: { value: TimelineMetric; label: string; description: string }[] = [
  { value: 'saldo_previsto', label: 'Saldo previsto', description: 'Mostra quanto você deve ter ao final de cada mês, somando receitas e descontando despesas previstas.' },
  { value: 'fluxo', label: 'Despesas e receitas', description: 'Resultado de cada mês — receitas menos despesas, pagas ou não.' },
  { value: 'despesas', label: 'Despesas', description: 'Total de despesas em cada mês, pagas ou não, com os filtros atuais.' },
  { value: 'despesas_fixas', label: 'Despesas fixas', description: 'Total de despesas recorrentes (aluguel, assinaturas) em cada mês.' },
  { value: 'receitas', label: 'Receitas', description: 'Total de receitas em cada mês, recebidas ou não, com os filtros atuais.' },
  { value: 'receitas_fixas', label: 'Receitas fixas', description: 'Total de receitas recorrentes em cada mês.' },
]

export function metricValue(point: TimelinePoint, metric: TimelineMetric): number | null {
  switch (metric) {
    case 'saldo_previsto': return point.saldoPrevisto
    case 'fluxo': return point.netCashFlow
    case 'despesas': return point.expense
    case 'despesas_fixas': return point.fixedExpense
    case 'receitas': return point.income
    case 'receitas_fixas': return point.fixedIncome
  }
}

// Melhor data disponível pra "quando essa conta passou a existir com esse
// saldo", usada como `accountsStartDate` de `buildFinancialTimeline`.
// Prioriza a data do lançamento `opening_balance` (migration 095 — editável
// pelo usuário no `AccountWizard`, pode ser retroativa) sobre `created_at`
// (só o timestamp de quando a linha foi inserida no banco, não
// necessariamente a data que o usuário escolheu pro saldo inicial). Cai
// pra `created_at` só pra conta sem esse lançamento: criada antes desta
// feature e ainda não migrada por backfill, saldo inicial zerado (nada pra
// registrar) ou cartão de crédito (nunca ganha um, saldo ali é fatura).
export function accountEffectiveStartDate(account: { id: string; created_at: string }, transactions: Transaction[]): Date {
  const openingTx = transactions.find((t) => t.account_id === account.id && t.source === 'opening_balance')
  return openingTx ? new Date(`${openingTx.date}T00:00:00`) : new Date(account.created_at)
}

function monthLabelFor(date: Date, currentYear: number) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long' })
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
  return date.getFullYear() === currentYear ? capitalized : `${capitalized} '${String(date.getFullYear()).slice(2)}`
}

// Linha do tempo mensal com saldo projetado (modelo GranaZen — ver
// system.architecture.md 7.20). `currentBalance` é o saldo real da(s)
// conta(s) AGORA (soma de `financial_accounts.balance`, que só reflete
// transações `is_paid=true`, seja qual for a data). A partir dele, a
// função "desfaz" o efeito pago das transações dentro da janela pra achar
// o saldo de antes do primeiro mês, e depois caminha mês a mês pra frente
// — não precisa buscar histórico anterior à janela, o saldo atual já
// carrega esse efeito embutido.
//
// Esse "desfazer" só é fiel enquanto a(s) conta(s) já existiam durante
// todo o mês em questão: o saldo inicial informado na criação da conta
// não é uma transação, então não há como a soma de transações pagas
// "desfazer" ele sozinha — sem `accountsStartDate`, meses anteriores à
// criação da conta ficariam mostrando o mesmo saldo atual, como se o
// usuário já tivesse esse dinheiro antes de a conta existir no sistema.
// `accountsStartDate` (menor `created_at` entre as contas ativas somadas
// em `currentBalance`) marca esse limite: meses inteiramente antes dele
// voltam `null` nos três campos de saldo em vez de um número inventado.
export function buildFinancialTimeline(
  transactions: Transaction[],
  currentBalance: number,
  monthsBack: number,
  monthsForward: number,
  accountsStartDate: Date | null = null,
  // IDs das contas somadas em `currentBalance` (ver `financial-dashboard.tsx`
  // — hoje exclui `credit`/`investment`). Sem isso, uma transação paga numa
  // conta de cartão/investimento (que nunca entrou em `currentBalance`)
  // seria "desfeita" por `paidNetWithinWindow` como se tivesse entrado,
  // inflando o saldo reconstruído — bug real encontrado 2026-09-27 assim
  // que uma fatura de cartão de verdade foi lançada com `is_paid=true`.
  // `null` (default) trata toda transação como "de conta de caixa", pra não
  // quebrar quem já chamava sem esse argumento. Pendente (`is_paid=false`)
  // continua contando de QUALQUER conta, inclusive cartão — é assim que uma
  // parcela futura de cartão aparece no Saldo Previsto (pedido do usuário:
  // "uma parcela 2/5 ainda vai cair em alguns meses pra frente").
  cashAccountIds: Set<string> | null = null
): TimelinePoint[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const windowStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const windowEndExclusive = new Date(now.getFullYear(), now.getMonth() + monthsForward + 1, 1)
  const accountsStartMonth = accountsStartDate ? new Date(accountsStartDate.getFullYear(), accountsStartDate.getMonth(), 1) : null
  const isCashAccount = (t: Transaction) => !cashAccountIds || cashAccountIds.has(t.account_id)

  let paidNetWithinWindow = 0
  for (const t of transactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue
    if (!t.is_paid || !isCashAccount(t)) continue
    const d = new Date(`${t.date}T00:00:00`)
    if (d < windowStart || d >= windowEndExclusive) continue
    paidNetWithinWindow += t.type === 'income' ? t.amount : -t.amount
  }
  let running = currentBalance - paidNetWithinWindow

  const points: TimelinePoint[] = []
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    // `incomeReceived`/`expensePaid` (exibidos em "Receitas"/"Despesas" e
    // somados em `income`/`expense`/`netCashFlow`) contam de QUALQUER conta
    // — uma compra paga no cartão é gasto de verdade pro mês, mesmo sem
    // ainda ter saído do caixa. Só a reconstrução de saldo (abaixo,
    // `cashIncomeReceived`/`cashExpensePaid`) precisa se restringir às
    // contas de caixa, pra ficar simétrica com `currentBalance`.
    let incomeReceived = 0, incomePending = 0, expensePaid = 0, expenseUnpaid = 0, fixedIncome = 0, fixedExpense = 0
    let cashIncomeReceived = 0, cashExpensePaid = 0
    for (const t of transactions) {
      if (t.type !== 'income' && t.type !== 'expense') continue
      if (t.date.slice(0, 7) !== month) continue
      if (t.type === 'income') {
        if (t.is_paid) { incomeReceived += t.amount; if (isCashAccount(t)) cashIncomeReceived += t.amount } else { incomePending += t.amount }
        if (t.source === 'recurring') fixedIncome += t.amount
      } else {
        if (t.is_paid) { expensePaid += t.amount; if (isCashAccount(t)) cashExpensePaid += t.amount } else { expenseUnpaid += t.amount }
        if (t.source === 'recurring') fixedExpense += t.amount
      }
    }

    const income = incomeReceived + incomePending
    const expense = expensePaid + expenseUnpaid
    const saldoAnteriorRunning = running
    const saldoDisponivelRunning = saldoAnteriorRunning + cashIncomeReceived - cashExpensePaid
    const saldoPrevistoRunning = saldoDisponivelRunning + incomePending - expenseUnpaid
    running = saldoDisponivelRunning

    // Mês inteiro anterior ao surgimento da(s) conta(s) no sistema: não há
    // saldo real nenhum pra mostrar, então os três campos ficam `null` em
    // vez de repetir o saldo atual (ver comentário da função).
    const noAccountYet = accountsStartMonth !== null && d < accountsStartMonth
    const saldoAnterior = noAccountYet ? null : saldoAnteriorRunning
    const saldoDisponivel = noAccountYet ? null : saldoDisponivelRunning
    const saldoPrevisto = noAccountYet ? null : saldoPrevistoRunning

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
