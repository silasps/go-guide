'use client'

import { useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getCurrencyFlag } from '@/lib/currency-mask'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  currencies: string[]
  value: string
  onChange: (currency: string) => void
  searchPlaceholder?: string
  /** Estilo do gatilho: 'pill' (padrão, compacto, pra usar ao lado de um label)
   *  ou 'field' (largura total, pra usar como um <select> normal de formulário). */
  triggerVariant?: 'pill' | 'field'
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

// Combobox com busca em vez de <select> nativo — mostra o nome da moeda (com o
// país/nacionalidade embutido, ex. "Peso colombiano", "Dólar americano") além do
// código, pra dar conta de moedas com o mesmo código-base em países diferentes
// (dólar, peso...). Nome vem de Intl.DisplayNames, já traduzido pro locale ativo.
// Busca só aparece com mais de 6 opções: com poucas moedas ela só atrapalha.
export function CurrencySelect({ currencies, value, onChange, searchPlaceholder, triggerVariant = 'pill' }: Props) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const names = useMemo(() => {
    const dn = new Intl.DisplayNames([locale], { type: 'currency' })
    const map: Record<string, string> = {}
    for (const c of currencies) map[c] = dn.of(c) ?? c
    return map
  }, [currencies, locale])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return currencies
    return currencies.filter(c => c.includes(q) || normalize(names[c] ?? '').includes(q))
  }, [currencies, query, names])

  return (
    <Popover open={open} onOpenChange={(next: boolean) => { setOpen(next); if (!next) setQuery('') }}>
      <PopoverTrigger className={triggerVariant === 'field'
        ? 'flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:border-ring'
        : 'inline-flex h-6 items-center gap-1 rounded-full border border-input bg-transparent pl-1.5 pr-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:border-ring'
      }>
        <span>{getCurrencyFlag(value)}</span>
        <span className={triggerVariant === 'field' ? 'flex-1 text-left' : undefined}>{value}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
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
        <div className="max-h-64 overflow-y-auto p-1">
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
              <span>{getCurrencyFlag(c)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c}</span>
                <span className="block truncate text-xs text-muted-foreground">{names[c]}</span>
              </span>
              {c === value && <Check className="h-3.5 w-3.5 shrink-0" />}
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
