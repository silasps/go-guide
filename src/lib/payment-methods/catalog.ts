import { QrCode, Landmark, CreditCard, Globe, Banknote, Wallet, Smartphone, HandCoins, Bitcoin, Coins, Zap, LucideIcon } from 'lucide-react'
import { PaymentMethodType } from '@/types/database'

export const PAYMENT_METHOD_GROUPS = ['popular', 'international', 'usLocal', 'asia', 'africa', 'sensitive', 'other', 'automatic'] as const
export type PaymentMethodGroup = typeof PAYMENT_METHOD_GROUPS[number]

interface PaymentMethodCatalogEntry {
  type: PaymentMethodType
  group: PaymentMethodGroup
  icon: LucideIcon
  hasDetails: boolean
}

export const PAYMENT_METHOD_CATALOG: PaymentMethodCatalogEntry[] = [
  { type: 'pix', group: 'popular', icon: QrCode, hasDetails: false },
  { type: 'mercadopago', group: 'popular', icon: Landmark, hasDetails: false },
  { type: 'paypal', group: 'international', icon: CreditCard, hasDetails: false },
  { type: 'wise', group: 'international', icon: Globe, hasDetails: false },
  { type: 'bank_transfer', group: 'international', icon: Banknote, hasDetails: true },
  { type: 'revolut', group: 'international', icon: Wallet, hasDetails: false },
  { type: 'zelle', group: 'usLocal', icon: Smartphone, hasDetails: false },
  { type: 'venmo', group: 'usLocal', icon: Smartphone, hasDetails: false },
  { type: 'cashapp', group: 'usLocal', icon: Smartphone, hasDetails: false },
  { type: 'alipay', group: 'asia', icon: QrCode, hasDetails: false },
  { type: 'wechatpay', group: 'asia', icon: QrCode, hasDetails: false },
  { type: 'mpesa', group: 'africa', icon: HandCoins, hasDetails: false },
  { type: 'crypto', group: 'sensitive', icon: Bitcoin, hasDetails: true },
  { type: 'other', group: 'other', icon: Coins, hasDetails: true },
  { type: 'stripe', group: 'automatic', icon: Zap, hasDetails: false },
]

// Sem 'stripe' — ele não passa pelo formulário genérico (é OAuth, ver StripeConnectCard).
export const MANUAL_PAYMENT_METHOD_CATALOG = PAYMENT_METHOD_CATALOG.filter(e => e.type !== 'stripe')

export function getPaymentMethodEntry(type: PaymentMethodType): PaymentMethodCatalogEntry {
  return PAYMENT_METHOD_CATALOG.find(e => e.type === type) ?? PAYMENT_METHOD_CATALOG[PAYMENT_METHOD_CATALOG.length - 1]
}
