import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">M</span>
          </div>
          <span className="font-semibold">go→guide</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>Entrar</Link>
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'sm' }))}>Criar conta</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto py-20 space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            A plataforma de comunicação<br />
            <span className="text-primary">missionária</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Publique atualizações, gerencie parceiros, controle finanças em múltiplas moedas e use IA para criar conteúdo — tudo em um só lugar.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mx-auto">
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'flex-1')}>
            Começar grátis
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1')}>
            Já tenho conta
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          {['Perfil público', 'CRM de parceiros', 'Financeiro multi-moeda', 'IA copiloto', 'Pedidos de oração', 'Notificações WhatsApp'].map(f => (
            <span key={f} className="bg-muted px-3 py-1 rounded-full text-muted-foreground">{f}</span>
          ))}
        </div>
      </main>
    </div>
  )
}
