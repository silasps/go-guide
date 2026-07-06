import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Cake } from 'lucide-react'
import { getUpcomingBirthdays, PartnerBirthdayInfo } from '@/lib/partners/birthdays'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  partners: PartnerBirthdayInfo[]
}

export async function BirthdayReminders({ partners }: Props) {
  const t = await getTranslations('Birthdays')
  const upcoming = getUpcomingBirthdays(partners)

  if (upcoming.length === 0) return null

  return (
    <div className="rounded-lg border border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950/30 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400 shrink-0" />
        <span className="font-medium text-pink-800 dark:text-pink-300">{t('title')}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {upcoming.map(({ partner, daysUntil, turningAge }) => {
          const waDigits = partner.phone?.replace(/\D/g, '')
          const actionHref = partner.user_id
            ? `/dashboard/mensagens/${partner.user_id}`
            : waDigits
              ? `https://wa.me/${waDigits}?text=${encodeURIComponent(t('waMessage', { name: partner.name.split(' ')[0] }))}`
              : null

          return (
            <li key={partner.id} className="flex items-center justify-between gap-3">
              <span className="text-pink-800 dark:text-pink-300">
                {partner.name} —{' '}
                {daysUntil === 0
                  ? t('today', { age: turningAge })
                  : daysUntil === 1
                    ? t('tomorrow', { age: turningAge })
                    : t('inDays', { days: daysUntil, age: turningAge })}
              </span>
              {actionHref && (
                <Link
                  href={actionHref}
                  target={partner.user_id ? undefined : '_blank'}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs shrink-0')}
                >
                  {t('sendWishes')}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
