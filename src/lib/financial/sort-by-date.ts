import { Transaction } from '@/types/database'

/** Mais recente primeiro por padrão (`ascending=false`) — como qualquer
 *  extrato de banco. `created_at` desempata dois lançamentos do mesmo dia
 *  pela ordem real de criação, não pela ordem que vieram do banco (sem
 *  `.order()` explícito, Postgres não garante nenhuma ordem estável). */
export function sortTransactionsByDate<T extends Pick<Transaction, 'date' | 'created_at'>>(
  transactions: T[],
  ascending = false
): T[] {
  return [...transactions].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    const cmp = byDate !== 0 ? byDate : a.created_at.localeCompare(b.created_at)
    return ascending ? cmp : -cmp
  })
}
