'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

const modes: { value: PrivacyMode; label: string; description: string; icon: React.ElementType; warn?: boolean }[] = [
  {
    value: 'public',
    label: 'Público',
    description: 'Seu perfil aparece no Google, URL amigável com @username. Parceiros e qualquer pessoa podem acessar.',
    icon: Globe,
  },
  {
    value: 'private',
    label: 'Privado',
    description: 'Acessível apenas com link direto + login de parceiro aprovado. Não indexado por buscadores.',
    icon: Lock,
  },
  {
    value: 'stealth',
    label: 'Stealth',
    description: 'Sem indexação (noindex), URL com hash aleatório, nome ocultado em meta tags, localização escondida. Máxima privacidade.',
    icon: EyeOff,
    warn: true,
  },
]

export function PrivacyForm({ profile }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<PrivacyMode>(profile.privacy_mode)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ privacy_mode: mode })
      .eq('id', profile.id)

    if (error) toast.error('Erro ao salvar.')
    else { toast.success('Privacidade atualizada!'); router.refresh() }
    setSaving(false)
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
                  Atenção: em modo Stealth, seu perfil fica inacessível para novos parceiros que não tenham o link.
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
        Salvar
      </Button>

      <div className="pt-4 border-t space-y-3">
        <h3 className="text-sm font-medium">Dados sensíveis (cifrados)</h3>
        <E2EEGate userId={profile.user_id}>
          <SensitiveDataForm profileId={profile.id} userId={profile.user_id} />
        </E2EEGate>
      </div>
    </div>
  )
}
