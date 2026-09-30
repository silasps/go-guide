'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FinancialAccount, TransactionCategory } from '@/types/database'
import { Loader2 } from 'lucide-react'

interface Props {
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
}

export function TransactionFilters({ accounts, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // `router.push` some sozinho de volta assim que agenda a navegação — não
  // espera o novo RSC chegar, então `await` nele não serviria de indicador.
  // `useTransition` é o jeito certo: `isPending` continua `true` até o
  // conteúdo novo (filtrado no servidor) realmente terminar de chegar,
  // cobrindo exatamente o intervalo que o usuário reportou "sem nenhuma
  // pista de que o filtro está rodando" entre o dropdown fechar e a lista
  // atualizar.
  const [isPending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    startTransition(() => {
      router.push(`/dashboard/financeiro/lancamentos?${params.toString()}`)
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
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
        <option value="none">Sem categoria</option>
        {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Filtrando..." />}
    </div>
  )
}
