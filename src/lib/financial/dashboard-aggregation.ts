import { Transaction, TransactionCategory } from '@/types/database'

export interface MonthlyPoint {
  month: string // 'YYYY-MM'
  monthLabel: string
  income: number
  expense: number
}

// Série mensal de entradas/saídas — alimenta o TrendChart. `monthsBack`
// inclui o mês corrente (monthsBack=6 => os últimos 6 meses, este incluído).
export function aggregateMonthly(transactions: Transaction[], monthsBack: number): MonthlyPoint[] {
  const points: MonthlyPoint[] = []
  const now = new Date()

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    points.push({ month, monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), income: 0, expense: 0 })
  }

  const byMonth = new Map(points.map((p) => [p.month, p]))
  for (const t of transactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue
    const month = t.date.slice(0, 7)
    const point = byMonth.get(month)
    if (!point) continue
    if (t.type === 'income') point.income += t.amount
    else point.expense += t.amount
  }

  return points
}

export interface CategorySlice {
  id: string
  name: string
  amount: number
  pct: number
}

function bucketByCategory(totals: Map<string, number>, categoryName: Map<string, string>, topN: number): CategorySlice[] {
  const total = [...totals.values()].reduce((s, v) => s + v, 0)
  if (total <= 0) return []

  const sorted = [...totals.entries()]
    .map(([id, amount]) => ({ id, name: id === '__uncategorized__' ? 'Sem categoria' : (categoryName.get(id) ?? 'Sem categoria'), amount }))
    .sort((a, b) => b.amount - a.amount)

  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN).reduce((s, c) => s + c.amount, 0)

  const slices: CategorySlice[] = top.map((c) => ({ ...c, pct: (c.amount / total) * 100 }))
  if (rest > 0) slices.push({ id: '__other__', name: 'Outros', amount: rest, pct: (rest / total) * 100 })

  return slices
}

// Composição de gastos por categoria pra um mês específico — alimenta o
// CategoryBarChart na Visão Geral. Top 6 + "Outros" (resto, sem matiz
// categórico próprio — não é uma categoria de verdade, é um bucket residual).
export function aggregateByCategory(
  transactions: Transaction[],
  categories: TransactionCategory[],
  month: string,
  topN = 6
): CategorySlice[] {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const totals = new Map<string, number>()

  for (const t of transactions) {
    if (t.type !== 'expense' || t.date.slice(0, 7) !== month) continue
    const key = t.category_id ?? '__uncategorized__'
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }

  return bucketByCategory(totals, categoryName, topN)
}

export type CategoryScope = 'all' | 'income' | 'expense' | 'expense_unpaid'

// Mesma composição por categoria, mas com o escopo do painel "Gráficos" da
// Visão Geral (ver 7.20): Todas (entrada+saída somadas) / Receitas /
// Despesas / Despesas Não Pagas.
export function aggregateByCategoryScoped(
  transactions: Transaction[],
  categories: TransactionCategory[],
  month: string,
  scope: CategoryScope,
  topN = 6
): CategorySlice[] {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const totals = new Map<string, number>()

  for (const t of transactions) {
    if (t.date.slice(0, 7) !== month) continue
    if (t.type !== 'income' && t.type !== 'expense') continue
    if (scope === 'income' && t.type !== 'income') continue
    if ((scope === 'expense' || scope === 'expense_unpaid') && t.type !== 'expense') continue
    if (scope === 'expense_unpaid' && t.is_paid) continue

    const key = t.category_id ?? '__uncategorized__'
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }

  return bucketByCategory(totals, categoryName, topN)
}

export interface FrequencyBucket {
  key: string
  label: string
  income: number
  expense: number
}

export type FrequencyGrouping = 'daily' | 'weekly'

// Receitas x Despesas dentro de um mês, agrupado por dia ou por semana —
// alimenta o FrequencyChart da aba Relatórios (ver 7.24). Diferente de
// `aggregateMonthly` (série de meses inteiros, pro TrendChart), aqui a
// janela é sempre um mês só, subdividido.
export function aggregateFrequency(transactions: Transaction[], month: string, grouping: FrequencyGrouping): FrequencyBucket[] {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()

  const buckets: FrequencyBucket[] = []
  if (grouping === 'daily') {
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m - 1, day)
      buckets.push({ key: String(day).padStart(2, '0'), label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), income: 0, expense: 0 })
    }
  } else {
    const weeks = Math.ceil(daysInMonth / 7)
    for (let w = 0; w < weeks; w++) {
      const start = w * 7 + 1
      const end = Math.min(start + 6, daysInMonth)
      buckets.push({ key: String(w), label: start === end ? `${start}` : `${start}-${end}`, income: 0, expense: 0 })
    }
  }

  const bucketForDay = (day: number) => grouping === 'daily' ? day - 1 : Math.floor((day - 1) / 7)

  for (const t of transactions) {
    if (t.date.slice(0, 7) !== month) continue
    if (t.type !== 'income' && t.type !== 'expense') continue
    const day = Number(t.date.slice(8, 10))
    const bucket = buckets[bucketForDay(day)]
    if (!bucket) continue
    if (t.type === 'income') bucket.income += t.amount
    else bucket.expense += t.amount
  }

  return buckets
}
