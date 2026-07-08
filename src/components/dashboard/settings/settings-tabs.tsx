'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Profile, ProfileManager, PaymentMethod } from '@/types/database'
import { ProfileForm } from './profile-form'
import { PaymentMethodsList } from './payment-methods-list'
import { PrivacyForm } from './privacy-form'
import { AccountForm } from './account-form'
import { AccessManagersForm } from './access-managers-form'
import { User, CreditCard, Lock, Settings, Users } from 'lucide-react'

interface Props {
  profile: Profile
  managers: ProfileManager[]
  paymentMethods: PaymentMethod[]
}

export function SettingsTabs({ profile, managers, paymentMethods }: Props) {
  const t = useTranslations('SettingsPage')
  const [activeTab, setActiveTab] = useState('perfil')

  const tabs = [
    { id: 'perfil', label: t('tabProfile'), icon: User },
    { id: 'pagamentos', label: t('tabPayments'), icon: CreditCard },
    { id: 'privacidade', label: t('tabPrivacy'), icon: Lock },
    { id: 'acesso', label: t('tabAccess'), icon: Users },
    { id: 'conta', label: t('tabAccount'), icon: Settings },
  ]

  return (
    <div className="space-y-0">
      {/* Tab bar — scrollable on mobile, icons on small screens */}
      <div className="flex border-b overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
              activeTab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content — instant switch, no navigation */}
      <div className="pt-6">
        {activeTab === 'perfil' && <ProfileForm profile={profile} />}
        {activeTab === 'pagamentos' && <PaymentMethodsList profileId={profile.id} methods={paymentMethods} />}
        {activeTab === 'privacidade' && <PrivacyForm profile={profile} />}
        {activeTab === 'acesso' && <AccessManagersForm profile={profile} managers={managers} />}
        {activeTab === 'conta' && <AccountForm profile={profile} />}
      </div>
    </div>
  )
}
