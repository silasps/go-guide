export const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']

export const CURRENCY_SEPARATORS: Record<string, { decimal: string; thousands: string }> = {
  BRL: { decimal: ',', thousands: '.' },
  EUR: { decimal: ',', thousands: '.' },
  USD: { decimal: '.', thousands: ',' },
  GBP: { decimal: '.', thousands: ',' },
  CHF: { decimal: '.', thousands: ',' },
  CAD: { decimal: '.', thousands: ',' },
  AUD: { decimal: '.', thousands: ',' },
}

/** Formats raw digits as cents, like a bank app amount field (digits fill in from the right). */
export function toMasked(raw: string, currency: string) {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  const { decimal, thousands } = CURRENCY_SEPARATORS[currency] ?? CURRENCY_SEPARATORS.BRL
  const cents = digits.padStart(3, '0')
  const intPart = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, thousands)
  const decPart = cents.slice(-2)
  return `${intPart}${decimal}${decPart}`
}

export function fromMasked(masked: string, currency: string) {
  const { decimal, thousands } = CURRENCY_SEPARATORS[currency] ?? CURRENCY_SEPARATORS.BRL
  let result = masked.split(thousands).join('')
  if (decimal !== '.') result = result.split(decimal).join('.')
  return result
}

/** Re-renders an already-masked value when the currency (and thus its separators) changes. */
export function reformatMasked(masked: string, oldCurrency: string, newCurrency: string) {
  if (!masked) return masked
  const plain = parseFloat(fromMasked(masked, oldCurrency))
  if (isNaN(plain)) return masked
  return toMasked(String(Math.round(plain * 100)), newCurrency)
}
