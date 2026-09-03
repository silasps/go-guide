'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { PASSWORD_REQUIREMENTS } from '@/lib/auth/password-requirements'
import { cn } from '@/lib/utils'

interface Props {
  password: string
}

export function PasswordRequirementsList({ password }: Props) {
  const t = useTranslations('PasswordRequirements')

  return (
    <ul className="space-y-1">
      {PASSWORD_REQUIREMENTS.map((req) => {
        const met = req.test(password)
        return (
          <li
            key={req.key}
            className={cn('flex items-center gap-1.5 text-xs transition-colors', met ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground')}
          >
            <span
              className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                met ? 'border-green-600 bg-green-600 dark:border-green-500 dark:bg-green-500' : 'border-current'
              )}
            >
              {met && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
            </span>
            {t(req.key)}
          </li>
        )
      })}
    </ul>
  )
}
