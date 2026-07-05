import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PRICING_PLANS } from '@/lib/pricing'
import {
  UserCircle, FolderHeart, Users, Wallet, HeartHandshake, Lock, Bell, Check,
  UserPlus, Settings2, FolderPlus,
} from 'lucide-react'

const modules = [
  { icon: UserCircle, title: 'Perfil público', description: 'Uma página profissional para você, com modo público, privado ou stealth — você decide quem vê o quê.' },
  { icon: FolderHeart, title: 'Projetos e campanhas', description: 'Metas financeiras, orçamento por categoria, marcos e relatórios — tudo em uma página que você compartilha com um link.' },
  { icon: Users, title: 'CRM de parceiros', description: 'Organize quem ora, quem contribui e quem representa sua missão, com notas e tags.' },
  { icon: Wallet, title: 'Financeiro multi-moeda', description: 'Contas, categorias e conciliação de ofertas — inclusive contas compartilhadas com sua equipe ou família.' },
  { icon: HeartHandshake, title: 'Pedidos de oração', description: 'Um canal direto entre você e seus parceiros de oração, com opção de conteúdo privado.' },
  { icon: Lock, title: 'Mensagens cifradas', description: 'Conversas ponta-a-ponta (E2EE) — nem nós temos acesso ao conteúdo.' },
  { icon: Bell, title: 'Notificações em tempo real', description: 'Saiba na hora quando alguém contribui, ora por você ou manda uma mensagem.' },
]

const steps = [
  { icon: UserPlus, title: 'Crie sua conta', description: 'Cadastro rápido com e-mail ou Google.' },
  { icon: Settings2, title: 'Configure seu perfil', description: 'Nome, foto, bio e história da sua missão.' },
  { icon: Wallet, title: 'Configure o recebimento', description: 'Pix, PayPal, Wise ou outro link de doação.' },
  { icon: FolderPlus, title: 'Crie seu primeiro projeto', description: 'Uma campanha para compartilhar com seus parceiros.' },
]

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
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/planos" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>Planos</Link>
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>Entrar</Link>
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'sm' }))}>Criar conta</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto py-20 space-y-8">
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
          <Link href="/planos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1')}>
            Ver planos
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-sm">
          {modules.map((m) => (
            <span key={m.title} className="bg-muted px-3 py-1 rounded-full text-muted-foreground">{m.title}</span>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-6 py-16 border-t bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Como funciona</h2>
          <p className="text-muted-foreground text-center mb-10">Em poucos minutos você já tem tudo pronto para compartilhar com seus parceiros.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ icon: Icon, title, description }, i) => (
              <div key={title} className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vitrine de módulos */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Tudo que sua missão precisa</h2>
          <p className="text-muted-foreground text-center mb-10">Substitua Instagram, WhatsApp, PDF, e-mail e Pix espalhados por um único sistema.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl ring-1 ring-foreground/10 bg-card p-5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos (teaser) */}
      <section className="px-6 py-16 border-t bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Planos para cada fase da missão</h2>
          <p className="text-muted-foreground text-center mb-10">Comece grátis. Faça upgrade quando sua rede de apoio crescer.</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {PRICING_PLANS.map((plan) => (
              <div key={plan.id} className={cn('rounded-xl ring-1 ring-foreground/10 bg-card p-5', plan.highlighted && 'ring-2 ring-primary')}>
                <p className="font-semibold text-sm">{plan.name}</p>
                <p className="text-2xl font-bold mt-2">{plan.priceMonthly === 0 ? 'Grátis' : `$${plan.priceMonthly}`}
                  {plan.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/planos" className={cn(buttonVariants({ size: 'lg' }))}>Ver todos os planos</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} go→guide</span>
          <div className="flex items-center gap-4">
            <Link href="/planos" className="hover:text-foreground transition-colors">Planos</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Entrar</Link>
            <Link href="/cadastro" className="hover:text-foreground transition-colors">Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
