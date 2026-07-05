import Stripe from 'stripe'

let stripe: Stripe | null = null

// Chaves ficam vazias até o Stripe ser ativado em produção — ver STRIPE_* em .env.example.
export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  return stripe
}
