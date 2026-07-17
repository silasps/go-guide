export interface BankDetailsFields {
  bankName: string
  swift: string
  routingNumber: string
  bankAddress: string
}

const FIELD_LABELS: Record<keyof BankDetailsFields, string> = {
  bankName: 'Banco',
  swift: 'SWIFT/BIC',
  routingNumber: 'Routing',
  bankAddress: 'País/endereço',
}

export function formatBankDetails(fields: BankDetailsFields): string {
  return (Object.keys(FIELD_LABELS) as (keyof BankDetailsFields)[])
    .filter(key => fields[key].trim())
    .map(key => `${FIELD_LABELS[key]}: ${fields[key].trim()}`)
    .join('\n')
}

export function parseBankDetails(details: string | null): BankDetailsFields {
  const fields: BankDetailsFields = { bankName: '', swift: '', routingNumber: '', bankAddress: '' }
  if (!details) return fields
  const labelToKey = Object.fromEntries(
    (Object.keys(FIELD_LABELS) as (keyof BankDetailsFields)[]).map(key => [FIELD_LABELS[key], key])
  ) as Record<string, keyof BankDetailsFields>

  for (const line of details.split('\n')) {
    const [label, ...rest] = line.split(': ')
    const key = labelToKey[label]
    if (key) fields[key] = rest.join(': ').trim()
  }
  return fields
}
