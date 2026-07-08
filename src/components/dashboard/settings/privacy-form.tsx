'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Profile, PrivacyMode } from '@/types/database'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Globe, Lock, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { E2EEGate } from '@/components/messages/e2ee-gate'
import { SensitiveDataForm } from './sensitive-data-form'

interface Props {
  profile: Profile
}

export function PrivacyForm({ profile }: Props) {
  const t = useTranslations('PrivacyForm')
  const router = useRouter()

  const modes: { value: PrivacyMode; label: string; description: string; icon: React.ElementType; warn?: boolean }[] = [
    { value: 'public', label: t('publicLabel'), description: t('publicDescription'), icon: Globe },
    { value: 'private', label: t('privateLabel'), description: t('privateDescription'), icon: Lock },
    { value: 'stealth', label: t('stealthLabel'), description: t('stealthDescription'), icon: EyeOff, warn: true },
  ]
  const [mode, setMode] = useState<PrivacyMode>(profile.privacy_mode)
  const { isPending: saving, run } = usePendingAction()

  function handleSave() {
    run(true, async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ privacy_mode: mode })
        .eq('id', profile.id)

      if (error) { toast.error(t('errorSave')); return }
      toast.success(t('updated'))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {modes.map(({ value, label, description, icon: Icon, warn }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={cn(
              'w-full flex items-start gap-4 rounded-lg border p-4 text-left transition-colors',
              mode === value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className={cn('mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0',
              mode === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              {warn && mode === value && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  {t('stealthWarning')}
                </p>
              )}
            </div>
            <div className={cn('ml-auto mt-1 h-4 w-4 rounded-full border-2 shrink-0 transition-colors',
              mode === value ? 'border-primary bg-primary' : 'border-muted-foreground'
            )} />
          </button>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('save')}
      </Button>

      <div className="pt-4 border-t space-y-3">
        <h3 className="text-sm font-medium">{t('sensitiveDataTitle')}</h3>
        <E2EEGate userId={profile.user_id}>
          <SensitiveDataForm profileId={profile.id} userId={profile.user_id} />
        </E2EEGate>
      </div>
    </div>
  )
}
