// Subconjunto conservador dos países atendidos pelo Stripe Connect Express
// (a Stripe cobre mais países, mas nem todos suportam Express/payouts — checar
// https://stripe.com/global antes de adicionar). País é obrigatório na criação
// da conta conectada e não pode ser trocado depois pelo missionário durante o
// onboarding, por isso é escolhido aqui antes de redirecionar pra Stripe.
export const STRIPE_CONNECT_COUNTRIES = [
  'BR', 'US', 'PT', 'ES', 'MX', 'GB', 'DE', 'FR', 'IT', 'CA', 'JP',
] as const
