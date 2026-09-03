// Janela de reanálise de oferta recusada: fica em destaque em Conciliação por
// PLEDGE_RECONSIDERATION_DAYS, depois arquivada (ainda reconfirmável) até
// completar PLEDGE_ARCHIVE_DAYS desde a recusa — sem coluna nova nem job
// agendado, tudo calculado em cima de `pledges.reviewed_at`.
export const PLEDGE_RECONSIDERATION_DAYS = 7
export const PLEDGE_ARCHIVE_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

export function daysSince(dateIso: string): number {
  return (Date.now() - new Date(dateIso).getTime()) / DAY_MS
}

export function addDays(dateIso: string, days: number): Date {
  return new Date(new Date(dateIso).getTime() + days * DAY_MS)
}
