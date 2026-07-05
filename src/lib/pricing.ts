export type PlanId = 'free' | 'pro' | 'mission'

export interface PricingPlan {
  id: PlanId
  priceMonthly: number
  priceYearly: number
  highlighted?: boolean
}

// Nome/tagline/features/cta ficam em messages/*.json (namespace "Pricing", chave = id),
// para suportar os 3 idiomas. Aqui só o que independe de idioma.
export const PRICING_PLANS: PricingPlan[] = [
  { id: 'free', priceMonthly: 0, priceYearly: 0 },
  { id: 'pro', priceMonthly: 20, priceYearly: 200, highlighted: true },
  { id: 'mission', priceMonthly: 45, priceYearly: 450 },
]

export interface ManagerAddon {
  seats: number
  priceMonthly: number
  stripePriceEnvVar: string
}

// Pacotes de gestores extras (além do incluído no plano — ver planLimits().managersIncluded
// em src/lib/utils.ts). Preço linear de R$7,50/assento, vendido em pacotes fechados.
export const MANAGER_ADDONS: ManagerAddon[] = [
  { seats: 2, priceMonthly: 15, stripePriceEnvVar: 'STRIPE_PRICE_MANAGERS_2' },
  { seats: 4, priceMonthly: 30, stripePriceEnvVar: 'STRIPE_PRICE_MANAGERS_4' },
]
