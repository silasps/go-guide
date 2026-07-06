'use client'

import { useState } from 'react'

interface Country {
  code: string
  name: string
  dial: string
  flag: string
  mask: string
}

const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷', mask: '(##) #####-####' },
  { code: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸', mask: '(###) ###-####' },
  { code: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹', mask: '### ### ###' },
  { code: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷', mask: '## ####-####' },
  { code: 'MX', name: 'México', dial: '52', flag: '🇲🇽', mask: '## #### ####' },
  { code: 'CO', name: 'Colômbia', dial: '57', flag: '🇨🇴', mask: '### ### ####' },
  { code: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱', mask: '# #### ####' },
  { code: 'PE', name: 'Peru', dial: '51', flag: '🇵🇪', mask: '### ### ###' },
  { code: 'PY', name: 'Paraguai', dial: '595', flag: '🇵🇾', mask: '### ######' },
  { code: 'BO', name: 'Bolívia', dial: '591', flag: '🇧🇴', mask: '########' },
  { code: 'UY', name: 'Uruguai', dial: '598', flag: '🇺🇾', mask: '#### ####' },
  { code: 'ES', name: 'Espanha', dial: '34', flag: '🇪🇸', mask: '### ### ###' },
  { code: 'AO', name: 'Angola', dial: '244', flag: '🇦🇴', mask: '### ### ###' },
  { code: 'MZ', name: 'Moçambique', dial: '258', flag: '🇲🇿', mask: '## ### ####' },
  { code: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧', mask: '#### ######' },
  { code: 'DE', name: 'Alemanha', dial: '49', flag: '🇩🇪', mask: '### #######' },
  { code: 'FR', name: 'França', dial: '33', flag: '🇫🇷', mask: '# ## ## ## ##' },
  { code: 'IT', name: 'Itália', dial: '39', flag: '🇮🇹', mask: '### ### ####' },
  { code: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦', mask: '(###) ###-####' },
  { code: 'JP', name: 'Japão', dial: '81', flag: '🇯🇵', mask: '##-####-####' },
]

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function maxDigits(mask: string) {
  return onlyDigits(mask.replace(/#/g, '9')).length
}

function applyMask(digits: string, mask: string) {
  let out = ''
  let di = 0
  for (let i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === '#') {
      out += digits[di]
      di++
    } else {
      out += mask[i]
    }
  }
  return out
}

function parseInitialValue(value: string) {
  const match = value.trim().match(/^\+(\d+)\s*(.*)$/)
  if (!match) return { countryIdx: 0, digits: onlyDigits(value) }
  const idx = COUNTRIES.findIndex((c) => c.dial === match[1])
  return { countryIdx: idx >= 0 ? idx : 0, digits: onlyDigits(match[2]) }
}

interface Props {
  defaultValue?: string
  onChange: (value: string) => void
  placeholder?: string
}

export function PhoneInput({ defaultValue = '', onChange, placeholder }: Props) {
  const [{ countryIdx, digits }, setState] = useState(() => parseInitialValue(defaultValue))
  const country = COUNTRIES[countryIdx]

  function emit(nextCountryIdx: number, nextDigits: string) {
    setState({ countryIdx: nextCountryIdx, digits: nextDigits })
    onChange(nextDigits ? `+${COUNTRIES[nextCountryIdx].dial} ${applyMask(nextDigits, COUNTRIES[nextCountryIdx].mask)}` : '')
  }

  return (
    <div className="flex gap-2">
      <select
        value={countryIdx}
        onChange={(e) => emit(Number(e.target.value), digits.slice(0, maxDigits(COUNTRIES[Number(e.target.value)].mask)))}
        aria-label="País"
        className="h-8 rounded-lg border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring"
      >
        {COUNTRIES.map((c, i) => (
          <option key={c.code} value={i}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>
      <input
        value={applyMask(digits, country.mask)}
        onChange={(e) => emit(countryIdx, onlyDigits(e.target.value).slice(0, maxDigits(country.mask)))}
        placeholder={placeholder ?? country.mask.replace(/#/g, '9')}
        inputMode="numeric"
        className="h-8 flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
      />
    </div>
  )
}
