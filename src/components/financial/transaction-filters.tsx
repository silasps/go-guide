'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FinancialAccount, TransactionCategory } from '@/types/database'

interface Props {
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
}

export function TransactionFilters({ accounts, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    router.push(`/dashboard/financeiro/lancamentos?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <select
        defaultValue={searchParams.get('account') ?? ''}
        onChange={(e) => update('account', e.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
      >
        <option value="">Todas as contas</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select
        defaultValue={searchParams.get('category') ?? ''}
        onChange={(e) => update('category', e.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
      >
        <option value="">Todas as categorias</option>
        {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  )
}
