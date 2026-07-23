'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pledge, Profile, Highlight } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { GivingFilters } from './giving-filters'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

type PledgeWithContext = Pledge & {
  profile: Pick<Profile, 'id' | 'display_name' | 'username'>
  highlight: Pick<Highlight, 'title'> | null
}

const STATUS_VARIANT: Record<Pledge['status'], 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'default',
  rejected: 'destructive',
}

export function GivingHistory({ pledges }: { pledges: PledgeWithContext[] }) {
  const t = useTranslations('PartnerFinance')
  const [missionaryFilter, setMissionaryFilter] = useState('all')

  const missionaries = useMemo(() => {
    const map = new Map<string, { id: string; display_name: string }>()
    for (const p of pledges) map.set(p.profile.id, { id: p.profile.id, display_name: p.profile.display_name })
    return Array.from(map.values())
  }, [pledges])

  const years = useMemo(() => {
    const set = new Set(pledges.filter((p) => p.status === 'confirmed').map((p) => new Date(p.reported_at).getFullYear()))
    return Array.from(set).sort((a, b) => b - a)
  }, [pledges])
  const [exportYear, setExportYear] = useState(years[0] ?? new Date().getFullYear())

  const filtered = missionaryFilter === 'all' ? pledges : pledges.filter((p) => p.profile.id === missionaryFilter)

  return (
    <div className="space-y-4">
      {years.length > 0 && (
        <div className="p-4 rounded-2xl border bg-card flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium mr-auto">{t('taxExportTitle')}</p>
          <select
            value={exportYear}
            onChange={(e) => setExportYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <a href={`/api/partner/tax-export?year=${exportYear}&format=csv`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a href={`/api/partner/tax-export?year=${exportYear}&format=pdf`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <Download className="h-3.5 w-3.5" /> PDF
          </a>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('taxExportDisclaimer')}</p>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('historyTitle')}</h2>
        <GivingFilters missionaries={missionaries} value={missionaryFilter} onChange={setMissionaryFilter} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('noGivingYet')}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border bg-card flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.profile.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.highlight?.title ?? t('generalGiving')} · {formatDate(p.reported_at)}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[p.status]} className="shrink-0">{t(`status.${p.status}`)}</Badge>
              <p className="text-sm font-medium shrink-0 w-24 text-right">{formatCurrency(p.reported_amount, p.currency)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
