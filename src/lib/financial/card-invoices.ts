// Pagamento de fatura de cartão (ver system.architecture.md 7.47). Núcleo
// puro — sem dependências de runtime, pra rodar direto no Node nos testes.
//
// Modelo: cada compra no cartão é uma despesa na conta do cartão, com
// `fatura_date` = mês em que a fatura fecha (`defaultFaturaDate`, mesma regra
// do TransactionForm). A fatura é paga por uma transferência em duas pernas
// (saída na conta corrente, entrada no cartão), ligadas por
// `transfer_group_id`. A perna de saída guarda `card_invoice_*` pra que cada
// fatura tenha no máximo um pagamento (índice único no banco).

export interface InvoiceLine {
  id: string
  account_id: string
  type: string
  amount: number
  is_paid: boolean
  fatura_date: string | null
  fatura_paid: boolean
}

export interface InvoicePaymentRow {
  id: string
  account_id: string
  transfer_group_id: string | null
  card_invoice_fatura_date: string | null
  card_invoice_account_id: string | null
  amount: number
  is_paid: boolean
  date: string
}

export interface CardConfig {
  id: string
  closing_day: number
  due_day: number
}

export type InvoiceSyncAction =
  | { kind: 'create'; cardId: string; checkingId: string; faturaDate: string; dueDate: string; amount: number }
  | { kind: 'update'; transferGroupId: string; amount: number }
  | { kind: 'delete'; transferGroupId: string }

const round2 = (n: number) => Math.round(n * 100) / 100

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Vencimento de uma fatura. `faturaDate` é o 1º dia do mês de fechamento.
// Se o dia de vencimento cai depois do fechamento, vence no mesmo mês; senão,
// no mês seguinte (ex.: fecha dia 22, vence dia 1 → vence no mês seguinte).
export function dueDateFor(faturaDate: string, closingDay: number, dueDay: number): string {
  const [y, m] = faturaDate.split('-').map(Number)
  const offset = dueDay > closingDay ? 0 : 1
  const dueMonthIndex = m - 1 + offset
  const lastDay = new Date(Date.UTC(y, dueMonthIndex + 1, 0)).getUTCDate()
  const day = Math.min(dueDay, lastDay)
  const due = new Date(Date.UTC(y, dueMonthIndex, day))
  return `${due.getUTCFullYear()}-${pad(due.getUTCMonth() + 1)}-${pad(due.getUTCDate())}`
}

// Compara o que o cartão deve (linhas de despesa ainda não pagas, agrupadas
// por fatura) com os pagamentos já agendados, e devolve o que criar, corrigir
// ou apagar. Só mexe em pagamento ainda pendente — um pagamento confirmado é
// histórico e não muda mais.
export function planInvoiceSync(
  card: CardConfig,
  lines: InvoiceLine[],
  payments: InvoicePaymentRow[],
  checkingId: string | null,
): InvoiceSyncAction[] {
  const totals = new Map<string, number>()
  for (const l of lines) {
    if (l.account_id !== card.id || l.type !== 'expense' || l.fatura_paid || !l.fatura_date) continue
    totals.set(l.fatura_date, (totals.get(l.fatura_date) ?? 0) + l.amount)
  }

  const paymentByFatura = new Map<string, InvoicePaymentRow>()
  for (const p of payments) {
    if (p.card_invoice_account_id !== card.id || !p.card_invoice_fatura_date) continue
    paymentByFatura.set(p.card_invoice_fatura_date, p)
  }

  const actions: InvoiceSyncAction[] = []

  for (const [faturaDate, rawTotal] of totals) {
    const total = round2(rawTotal)
    const payment = paymentByFatura.get(faturaDate)
    if (!payment) {
      if (checkingId) {
        actions.push({ kind: 'create', cardId: card.id, checkingId, faturaDate, dueDate: dueDateFor(faturaDate, card.closing_day, card.due_day), amount: total })
      }
      continue
    }
    if (!payment.is_paid && payment.transfer_group_id && round2(payment.amount) !== total) {
      actions.push({ kind: 'update', transferGroupId: payment.transfer_group_id, amount: total })
    }
  }

  // Pagamento pendente de uma fatura que não tem mais nada em aberto (ex.: a
  // linha foi apagada) sai da previsão.
  for (const p of paymentByFatura.values()) {
    if (!p.is_paid && p.transfer_group_id && p.card_invoice_fatura_date && !totals.has(p.card_invoice_fatura_date)) {
      actions.push({ kind: 'delete', transferGroupId: p.transfer_group_id })
    }
  }

  return actions
}
