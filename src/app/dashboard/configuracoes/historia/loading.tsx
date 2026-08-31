import { SkHeader, SkForm } from '@/components/ui/skeleton'

// Sem loading.tsx próprio, essa rota herdava o esqueleto genérico de
// configuracoes/loading.tsx (sem largura/centralização) — piscava
// alinhado à esquerda e depois "pulava" pro centro quando a página real
// (max-w-lg mx-auto) terminava de carregar. Esqueleto próprio evita o salto.
export default function Loading() {
  return (
    <div className="max-w-lg mx-auto">
      <SkHeader />
      <SkForm n={5} />
    </div>
  )
}
