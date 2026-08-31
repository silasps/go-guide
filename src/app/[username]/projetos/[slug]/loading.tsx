import { Sk } from '@/components/ui/skeleton'

// Sem loading.tsx próprio, essa rota caía no fallback genérico de
// [username]/loading.tsx (esqueleto de perfil — avatar + grid de cards),
// bem diferente da forma real desta página (capa grande + título + card
// financeiro) — o usuário reportou sensação de travamento ao abrir um
// projeto pela listagem. Esqueleto dedicado aparece imediatamente ao
// clicar, na mesma forma da página real, então a troca não "pisca".
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20 space-y-6">
        <Sk className="aspect-[1.91/1] w-full rounded-2xl" />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sk className="h-7 flex-1 max-w-xs" />
            <Sk className="h-6 w-16 rounded-full shrink-0" />
            <Sk className="h-8 w-8 rounded-full shrink-0" />
          </div>
          <Sk className="h-4 w-3/4" />
        </div>
        <div className="space-y-2">
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-2/3" />
        </div>
        <Sk className="h-40 w-full rounded-2xl" />
        <Sk className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  )
}
