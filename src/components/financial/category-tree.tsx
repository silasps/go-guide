'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, cn } from '@/lib/utils'
import { TransactionCategory } from '@/types/database'
import { CategoryForm } from './category-form'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Pencil, ChartPie, Search } from 'lucide-react'

interface SpendingLimitLite {
  category_id: string
  limit_amount: number
  currency: string
}

interface Props {
  profileId: string
  categories: TransactionCategory[]
  limits: SpendingLimitLite[]
}

const DEFAULT_COLOR = 'var(--muted-foreground)'

// Estilo GranaZen (ver 7.26): cor por categoria (schema já tinha a coluna
// `color`, nunca usada até aqui), "Limite de gasto" por categoria de topo
// (junta com `spending_limits`, ver 7.20/7.21), busca, link direto pros
// lançamentos daquela categoria. Deliberadamente fora desta rodada:
// arquivar/desarquivar categoria (exigiria coluna nova + tocar todo lugar
// que lista categorias — TransactionForm, CategoryBarChart, etc. — pra
// filtrar arquivadas; feature grande o bastante pra ser sua própria
// rodada) e o menu "Ações" colapsado no mobile (os botões já cabem soltos).
export function CategoryTree({ profileId, categories, limits }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [creatingTop, setCreatingTop] = useState(false)
  const [editing, setEditing] = useState<TransactionCategory | null>(null)
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const { pendingValue: deletingId, run: runDelete } = usePendingAction<string>()

  const limitByCategory = new Map(limits.map((l) => [l.category_id, l]))
  const totalLimit = limits.reduce((s, l) => s + l.limit_amount, 0)
  const limitCurrency = limits[0]?.currency ?? 'BRL'

  const term = search.trim().toLowerCase()
  const matches = (c: TransactionCategory) => !term || c.name.toLowerCase().includes(term)
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id && matches(c))
  const top = categories.filter((c) => !c.parent_id && (matches(c) || childrenOf(c.id).length > 0))

  function removeCategory(cat: TransactionCategory) {
    if (!confirm(`Excluir a categoria "${cat.name}"?`)) return
    runDelete(cat.id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('transaction_categories').delete().eq('id', cat.id)
      if (error) { toast.error('Erro ao excluir categoria.'); return }
      toast.success('Categoria excluída.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Pesquisar categorias..." className="pl-9" />
        </div>
        <Button onClick={() => setCreatingTop(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar categoria
        </Button>
      </div>

      {limits.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border bg-card px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Valor total do limite de gastos: <span className="font-semibold text-foreground">{formatCurrency(totalLimit, limitCurrency)}</span>
          </span>
          <Link href="/dashboard/financeiro/limites" className="text-xs text-primary hover:underline shrink-0">Ver limites de gastos</Link>
        </div>
      )}

      <div className="space-y-3">
        {top.map((cat) => {
          const limit = limitByCategory.get(cat.id)
          const subs = childrenOf(cat.id)
          const color = cat.color ?? DEFAULT_COLOR
          return (
            <div key={cat.id} className="rounded-xl border bg-card p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 size-5 shrink-0 rounded-md" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Limite de gasto: {limit ? formatCurrency(limit.limit_amount, limit.currency) : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/dashboard/financeiro/lancamentos?category=${cat.id}`} title="Ver lançamentos" className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}>
                    <ChartPie className="h-3.5 w-3.5" />
                  </Link>
                  <Button variant="outline" size="icon-sm" title="Editar" onClick={() => setEditing(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon-sm" title="Adicionar subcategoria" onClick={() => setAddingSubTo(cat.id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon-sm" title="Excluir" onClick={() => removeCategory(cat)} disabled={deletingId === cat.id}>
                    {deletingId === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {subs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-7">
                  {subs.map((sub) => (
                    <span key={sub.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: sub.color ?? color }} />
                      {sub.name}
                      <button type="button" onClick={() => removeCategory(sub)} disabled={deletingId === sub.id} className="text-muted-foreground hover:text-destructive">
                        {deletingId === sub.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {top.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {term ? 'Nenhuma categoria encontrada.' : 'Nenhuma categoria ainda.'}
          </p>
        )}
      </div>

      {creatingTop && <CategoryForm open onOpenChange={setCreatingTop} profileId={profileId} />}
      {editing && <CategoryForm open onOpenChange={(v) => !v && setEditing(null)} profileId={profileId} category={editing} />}
      {addingSubTo && <CategoryForm open onOpenChange={(v) => !v && setAddingSubTo(null)} profileId={profileId} parentId={addingSubTo} />}
    </div>
  )
}
