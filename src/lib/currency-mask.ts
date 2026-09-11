export const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']

// Todas as moedas ISO 4217 em circulação (via Intl.supportedValuesOf), menos as
// que já saíram de uso (HRK, CUC, XDR — DES do FMI, não é moeda transacionável, XSU).
export const ALL_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB',
  'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX',
  'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF',
  'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
]

const FLAG_OVERRIDES: Record<string, string> = {
  EUR: '🇪🇺', ANG: '🇨🇼', XCD: '🌴', XOF: '🌍', XAF: '🌍', XPF: '🌴',
}

/** Deriva o emoji de bandeira do código da moeda: nas moedas nacionais ISO 4217 as
 *  duas primeiras letras já são o código do país (BRL→BR, ARS→AR...), então dá pra
 *  gerar a bandeira sem manter um mapa de ~160 entradas na mão. */
export function getCurrencyFlag(code: string) {
  if (CURRENCY_FLAGS[code]) return CURRENCY_FLAGS[code]
  if (FLAG_OVERRIDES[code]) return FLAG_OVERRIDES[code]
  const countryCode = code.slice(0, 2)
  return [...countryCode].map(ch => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('')
}

// Taxa da Stripe tem uma parte fixa por transação (~R$0,39 no Brasil) que
// come uma fatia desproporcional de valores muito pequenos — só se aplica
// a cartão (Stripe), métodos manuais (Pix, transferência, etc.) não têm
// esse custo e por isso não têm mínimo.
export const MIN_STRIPE_AMOUNT = 10

export const CURRENCY_FLAGS: Record<string, string> = {
  BRL: '🇧🇷', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CHF: '🇨🇭', CAD: '🇨🇦', AUD: '🇦🇺',
}

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
