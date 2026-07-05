import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { PricingToggle } from '@/components/pricing/pricing-toggle'
import { cn } from '@/lib/utils'

export default function PlanosPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">M</span>
          </div>
          <span className="font-semibold">go→guide</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>Entrar</Link>
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'sm' }))}>Criar conta</Link>
        </div>
      </nav>

      <main className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Um plano para cada fase da sua missão</h1>
          <p className="text-muted-foreground mt-3">
            Troque planilhas, PDFs e mensagens espalhadas por um único lugar onde seus parceiros acompanham sua missão — e você recebe o apoio deles com transparência.
          </p>
        </div>

        <PricingToggle />

        <div className="mt-16 grid sm:grid-cols-3 gap-6 text-center max-w-3xl mx-auto">
          <div>
            <p className="font-semibold text-sm">Cancele quando quiser</p>
            <p className="text-xs text-muted-foreground mt-1">Sem contrato de fidelidade.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Seus dados, seu controle</p>
            <p className="text-xs text-muted-foreground mt-1">Dados sensíveis cifrados ponta-a-ponta.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">O dinheiro vai direto a você</p>
            <p className="text-xs text-muted-foreground mt-1">A plataforma nunca intermedia suas ofertas.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
