export type PlanId = 'free' | 'pro' | 'mission'

export interface PricingPlan {
  id: PlanId
  name: string
  tagline: string
  priceMonthly: number
  priceYearly: number
  features: string[]
  cta: string
  highlighted?: boolean
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Para experimentar a plataforma',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Perfil público',
      'Até 2 parceiros',
      '1 publicação por mês',
      'Pedidos de oração',
    ],
    cta: 'Começar grátis',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para quem vive de apoio de parceiros',
    priceMonthly: 20,
    priceYearly: 200,
    features: [
      'Parceiros e publicações ilimitados',
      'Financeiro multi-moeda',
      'Projetos e campanhas ilimitados',
      '50 créditos de IA por mês',
      'Mensagens e dados sensíveis cifrados (E2EE)',
    ],
    cta: 'Assinar Pro',
    highlighted: true,
  },
  {
    id: 'mission',
    name: 'Missão',
    tagline: 'Para casais e famílias em campo',
    priceMonthly: 45,
    priceYearly: 450,
    features: [
      'Tudo do Pro',
      'Conta compartilhada (casal/família/equipe)',
      'Projeto compartilhado e editável em equipe',
      'Notificações via WhatsApp',
      '150 créditos de IA por mês',
    ],
    cta: 'Assinar Missão',
  },
]
