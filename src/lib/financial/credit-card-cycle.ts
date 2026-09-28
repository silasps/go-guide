// Traduz "dia de fechamento"/"dia de vencimento" (os dois números que o
// cartão realmente guarda, e se repetem todo mês) em datas de calendário
// de verdade pro ciclo mais próximo — mesma ideia que qualquer app de banco
// mostra ("Vence: 01/10/2026"), só que calculada localmente, sem depender
// de fatura importada. Também deriva a "melhor data de compra" (dia
// seguinte ao próximo fechamento — maximiza os dias sem juros até o
// vencimento seguinte), recurso padrão nos apps de banco brasileiros.
export interface CreditCardCycleDates {
  nextClosingDate: Date
  nextDueDate: Date
  bestPurchaseDate: Date
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function setDayClamped(base: Date, day: number): Date {
  const year = base.getFullYear()
  const month = base.getMonth()
  return new Date(year, month, Math.min(day, daysInMonth(year, month)))
}

function firstOfMonth(date: Date, monthOffset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1)
}

export function getCreditCardCycleDates(closingDay: number, dueDay: number, today: Date = new Date()): CreditCardCycleDates {
  // Fechamento deste mês já passou (ou é hoje)? Se sim, o próximo é mês que vem.
  const closingAlreadyHappened = today.getDate() > closingDay
  const nextClosingDate = setDayClamped(firstOfMonth(today, closingAlreadyHappened ? 1 : 0), closingDay)

  // Vencimento normalmente cai no mesmo mês do fechamento quando o dia de
  // vencimento é maior (ex.: fecha dia 15, vence dia 22); quando o dia de
  // vencimento é menor ou igual, é porque o ciclo virou o mês (ex.: fecha
  // dia 28, vence dia 5 do mês seguinte).
  const dueMonthOffset = dueDay > closingDay ? 0 : 1
  const nextDueDate = setDayClamped(firstOfMonth(nextClosingDate, dueMonthOffset), dueDay)

  const bestPurchaseDate = new Date(nextClosingDate)
  bestPurchaseDate.setDate(bestPurchaseDate.getDate() + 1)

  return { nextClosingDate, nextDueDate, bestPurchaseDate }
}
