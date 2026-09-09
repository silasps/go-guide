import { formatCurrency, cn } from '@/lib/utils'

interface Props {
  totalSpent: number
  totalLimit: number
  currency: string
}

// Cabeçalho "Gastos por categoria" estilo GranaZen: soma dos limites
// cadastrados vs. TODA despesa categorizada do mês (não só as categorias
// com limite — unificado com o mesmo número da aba "Geral" a pedido do
// usuário, que viu as duas abas mostrando porcentagens diferentes pro
// "mesmo" limite total e achou confuso). Sem wrapper/borda própria e sem o
// marcador "Hoje" (que agora é desenhado uma única vez por
// `SpendingLimitsTabs`, atravessando este bloco + a lista de categorias
// abaixo dele — ver comentário lá).
export function SpendingLimitsOverview({ totalSpent, totalLimit, currency }: Props) {
  if (totalLimit <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum limite cadastrado ainda. Defina um limite numa categoria abaixo para acompanhar o progresso aqui.
      </p>
    )
  }

  const pct = Math.min(100, (totalSpent / totalLimit) * 100)
  const overLimit = totalSpent > totalLimit
  const barColor = overLimit ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-success'
  const pctColor = overLimit ? 'text-destructive' : pct >= 80 ? 'text-warning' : 'text-success'

  return (
    <div className="space-y-2">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Gastos por categoria</p>
        <p className="text-lg font-semibold">
          {formatCurrency(totalSpent, currency)} <span className="font-normal text-muted-foreground">de {formatCurrency(totalLimit, currency)}</span>
        </p>
      </div>

      <div className="h-7 rounded-lg bg-muted overflow-hidden">
        <div className={cn('h-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Progresso do limite total</span>
        <span className={cn('text-xs font-semibold', pctColor)}>{Math.round(pct)}%</span>
      </div>
    </div>
  )
}
