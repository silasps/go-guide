import { TransactionWithCategory } from '@/types/database'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

const MONTH_NAMES: Record<string, number> = {
  janeiro: 0, jan: 0,
  fevereiro: 1, fev: 1,
  marco: 2, mar: 2,
  abril: 3, abr: 3,
  maio: 4, mai: 4,
  junho: 5, jun: 5,
  julho: 6, jul: 6,
  agosto: 7, ago: 7,
  setembro: 8, set: 8,
  outubro: 9, out: 9,
  novembro: 10, nov: 10,
  dezembro: 11, dez: 11,
}

// Vocabulário enxuto de status — cobre o caso comum sem tentar modelar
// frases de dois tokens ("não pago"): o tokenizer separa por espaço e
// exige TODOS os tokens batendo, então uma palavra só cobre melhor.
const STATUS_TERMS: Record<string, (t: TransactionWithCategory) => boolean> = {
  pago: (t) => t.type === 'expense' && t.is_paid,
  pagos: (t) => t.type === 'expense' && t.is_paid,
  pagar: (t) => t.type === 'expense' && !t.is_paid,
  recebido: (t) => t.type === 'income' && t.is_paid,
  recebidos: (t) => t.type === 'income' && t.is_paid,
  receber: (t) => t.type === 'income' && !t.is_paid,
  pendente: (t) => !t.is_paid,
  pendentes: (t) => !t.is_paid,
  receita: (t) => t.type === 'income',
  receitas: (t) => t.type === 'income',
  despesa: (t) => t.type === 'expense',
  despesas: (t) => t.type === 'expense',
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Testado token a token (não a query inteira) — "setembro 2026" já
// decompõe certo em ["setembro", "2026"] via o AND entre tokens de
// `filterTransactions`, sem precisar entender a frase combinada aqui.
function dateMatches(t: TransactionWithCategory, token: string): boolean {
  const d = new Date(`${t.date}T00:00:00`)

  if (token === 'hoje') return isSameDay(d, new Date())
  if (token === 'ontem') {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return isSameDay(d, yesterday)
  }

  if (token in MONTH_NAMES) return d.getMonth() === MONTH_NAMES[token]

  if (/^\d{4}$/.test(token)) return d.getFullYear() === parseInt(token, 10)

  const dm = token.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (dm) {
    const [, dayStr, monthStr, yearStr] = dm
    if (d.getDate() !== parseInt(dayStr, 10)) return false
    if (d.getMonth() + 1 !== parseInt(monthStr, 10)) return false
    if (yearStr) {
      const year = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10)
      return d.getFullYear() === year
    }
    return true
  }

  return false
}

// Compara só sequência de dígitos (ignora `.`/`,` de formatação) contra o
// valor inteiro e contra o valor com centavos — "1800", "1.800" e
// "1800,00" batem todos com R$ 1.800,00 do mesmo jeito.
function amountMatches(amount: number, token: string): boolean {
  const queryDigits = onlyDigits(token)
  if (queryDigits.length < 2) return false
  const wholeDigits = onlyDigits(String(Math.trunc(Math.abs(amount))))
  const centsDigits = onlyDigits(Math.abs(amount).toFixed(2))
  return wholeDigits.includes(queryDigits) || centsDigits.includes(queryDigits)
}

function tokenMatches(t: TransactionWithCategory, token: string, haystack: string): boolean {
  if (haystack.includes(token)) return true
  if (STATUS_TERMS[token]?.(t)) return true
  if (dateMatches(t, token)) return true
  if (amountMatches(t.amount, token)) return true
  return false
}

/**
 * Filtro de lançamentos: cada token da busca (separado por espaço) precisa
 * bater em ALGUM critério (nome/categoria/parceiro, status, data ou
 * valor) — múltiplos tokens combinam em E ("aluguel setembro" exige nome
 * batendo E mês batendo). `extraTerms` (sinônimos vindos da IA, ver
 * `useTransactionSearch`) funcionam como alternativa OU pra frase inteira,
 * só usados quando o match direto não encontrou nada.
 */
export function filterTransactions(
  transactions: TransactionWithCategory[],
  query: string,
  extraTerms: string[] = []
): TransactionWithCategory[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return transactions

  const normalizedExtraTerms = extraTerms.map(normalize).filter(Boolean)

  return transactions.filter((t) => {
    const haystack = normalize([t.description, t.category?.name, t.subcategory?.name, t.partner?.name].filter(Boolean).join(' '))
    if (tokens.every((token) => tokenMatches(t, token, haystack))) return true
    return normalizedExtraTerms.some((term) => haystack.includes(term))
  })
}
