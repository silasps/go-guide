'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'CLP', 'PYG', 'UYU', 'CAD', 'JPY']

interface RatesResponse {
  result: string
  time_last_update_utc: string
  rates: Record<string, number>
}

export default function CambioPage() {
  const [base, setBase] = useState('USD')
  const [target, setTarget] = useState('BRL')
  const [amount, setAmount] = useState('1')
  const [data, setData] = useState<RatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadRates() {
      setLoading(true)
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
        const json: RatesResponse = await res.json()
        if (!active) return
        if (json.result !== 'success') { setError('Não foi possível buscar a cotação agora.'); return }
        setError('')
        setData(json)
      } catch {
        if (active) setError('Não foi possível buscar a cotação agora.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRates()
    return () => { active = false }
  }, [base])

  const converted = useMemo(() => {
    const value = Number(amount.replace(',', '.'))
    const rate = data?.rates?.[target]
    if (!Number.isFinite(value) || !rate) return null
    return value * rate
  }, [amount, data, target])

  const rate = data?.rates?.[target]

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input inputMode="decimal" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>De</Label>
              <select value={base} onChange={(e) => setBase(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Para</Label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="rounded-lg border border-input bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Resultado</p>
            {loading ? (
              <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="mt-1 text-2xl font-semibold">{converted != null ? formatCurrency(converted, target) : '—'}</p>
            )}
            {rate && <p className="mt-1 text-xs text-muted-foreground">1 {base} = {rate.toFixed(4)} {target}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
