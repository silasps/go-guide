'use client'

import { useTranslations } from 'next-intl'
import { ProfileAccountType } from '@/types/database'
import { cn } from '@/lib/utils'
import { User, Users, Building2 } from 'lucide-react'

const OPTION_TYPES: { value: ProfileAccountType; icon: React.ElementType }[] = [
  { value: 'individual', icon: User },
  { value: 'family', icon: Users },
  { value: 'organization', icon: Building2 },
]

interface Props {
  value: ProfileAccountType
  onChange: (value: ProfileAccountType) => void
}

export function AccountTypeSelector({ value, onChange }: Props) {
  const t = useTranslations('AccountType')

  return (
    <div className="space-y-2">
      {OPTION_TYPES.map(({ value: v, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
            value === v ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
          )}
        >
          <div className={cn('mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0',
            value === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-medium text-sm">{t(`${v}Label`)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(`${v}Description`)}</p>
          </div>
          <div className={cn('ml-auto mt-1 h-3.5 w-3.5 rounded-full border-2 shrink-0 transition-colors',
            value === v ? 'border-primary bg-primary' : 'border-muted-foreground'
          )} />
        </button>
      ))}
      {value === 'organization' && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
          {t('organizationHint')}
        </p>
      )}
    </div>
  )
}

export function useAccountTypeCopy(accountType: ProfileAccountType) {
  const t = useTranslations('AccountType')
  const capitalized = accountType.charAt(0).toUpperCase() + accountType.slice(1)
  return {
    bioPlaceholder: t(`bioPlaceholder${capitalized}` as 'bioPlaceholderIndividual'),
    bioHint: t(`bioHint${capitalized}` as 'bioHintIndividual'),
    displayNamePlaceholder: t(`displayNamePlaceholder${capitalized}` as 'displayNamePlaceholderIndividual'),
  }
}
