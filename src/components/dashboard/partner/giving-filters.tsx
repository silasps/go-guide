'use client'

import { useTranslations } from 'next-intl'

interface Props {
  missionaries: { id: string; display_name: string }[]
  value: string
  onChange: (value: string) => void
}

export function GivingFilters({ missionaries, value, onChange }: Props) {
  const t = useTranslations('PartnerFinance')

  if (missionaries.length <= 1) return null

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="all">{t('filterAllMissionaries')}</option>
      {missionaries.map((m) => (
        <option key={m.id} value={m.id}>{m.display_name}</option>
      ))}
    </select>
  )
}
