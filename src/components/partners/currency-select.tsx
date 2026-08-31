'use client'

import { useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CURRENCY_FLAGS } from '@/lib/currency-mask'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  currencies: string[]
  value: string
  onChange: (currency: string) => void
  searchPlaceholder?: string
}

// Combobox com busca em vez de <select> nativo — mais bonito e prepara o
// terreno pra lista crescer (hoje só 7 moedas, ver CURRENCIES em
// currency-mask.ts). Busca só aparece com mais de 6 opções: com poucas
// moedas ela só atrapalha.
export function CurrencySelect({ currencies, value, onChange, searchPlaceholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    return q ? currencies.filter(c => c.includes(q)) : currencies
  }, [currencies, query])

  return (
    <Popover open={open} onOpenChange={(next: boolean) => { setOpen(next); if (!next) setQuery('') }}>
      <PopoverTrigger className="inline-flex h-6 items-center gap-1 rounded-full border border-input bg-transparent pl-1.5 pr-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:border-ring">
        <span>{CURRENCY_FLAGS[value] ?? '🏳️'}</span>
        <span>{value}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-0">
        {currencies.length > 6 && (
          <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-5 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); setQuery('') }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                c === value && 'bg-accent'
              )}
            >
              <span>{CURRENCY_FLAGS[c] ?? '🏳️'}</span>
              <span className="flex-1">{c}</span>
              {c === value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">—</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
