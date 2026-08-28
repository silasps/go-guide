'use client'

import { useTranslations } from 'next-intl'
import { getPaymentMethodEntry } from '@/lib/payment-methods/catalog'
import { PledgePaymentMethod } from '@/types/database'

interface Option {
  id: string
  method: PledgePaymentMethod
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (id: string) => void
}

// Mini-cards de método de pagamento (ícone + rótulo), substituindo o
// dropdown antigo — puxado do mockup do Stitch: a pessoa reconhece o Pix
// pelo ícone na hora, em vez de abrir um <select> e procurar o nome.
export function PaymentMethodCards({ options, value, onChange }: Props) {
  const t = useTranslations('PaymentMethods')

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(opt => {
        const { icon: Icon } = getPaymentMethodEntry(opt.method)
        const active = opt.id === value
        // No card, mostra o nome genérico do tipo (ex. "Pix"), não o rótulo
        // customizado inteiro (ex. o nome completo na chave) — não cabe no
        // card. Mas se o missionário tem mais de uma chave do mesmo tipo
        // (ex. duas chaves Pix, uma por pessoa da família), "Pix"/"Pix" fica
        // ambíguo — complementa com o primeiro nome do rótulo customizado
        // ("Pix Silas") só quando esse rótulo existir e for diferente do
        // nome genérico (senão vira "Pix Pix" pro caso comum de só uma
        // chave sem rótulo próprio).
        const genericLabel = t(`type_${opt.method}`)
        const customLabel = opt.label.trim()
        const firstName = customLabel && customLabel !== genericLabel ? customLabel.split(/\s+/)[0] : null
        const cardLabel = opt.method === 'stripe' ? opt.label : (firstName ? `${genericLabel} ${firstName}` : genericLabel)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors ${
              active ? 'border-primary bg-primary/5 shadow-sm' : 'border-input bg-transparent hover:border-primary/40'
            }`}
          >
            <Icon className={`h-6 w-6 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="w-full truncate text-xs font-medium">{cardLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
