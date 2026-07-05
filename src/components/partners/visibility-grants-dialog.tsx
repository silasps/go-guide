'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as keyManager from '@/lib/crypto/key-manager'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'

const SECTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'full_profile', label: 'Perfil completo', desc: 'Ver o perfil mesmo em modo privado/stealth' },
  { value: 'financial_summary', label: 'Resumo financeiro', desc: 'Ver o progresso financeiro dos projetos' },
  { value: 'prayer_requests', label: 'Pedidos de oração', desc: 'Ver pedidos de oração marcados como privados' },
  { value: 'sensitive_fields', label: 'Dados sensíveis', desc: 'Localização real, itinerário, notas privadas' },
  { value: 'messages', label: 'Mensagens', desc: 'Trocar mensagens diretas' },
]

interface Props {
  profileId: string
  partnerId: string
  partnerUserId: string
  partnerName: string
  initialGrants: string[]
}

export function VisibilityGrantsDialog({ profileId, partnerId, partnerUserId, partnerName, initialGrants }: Props) {
  const [open, setOpen] = useState(false)
  const [grants, setGrants] = useState<string[]>(initialGrants)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(section: string) {
    setSaving(section)
    const supabase = createClient()
    if (grants.includes(section)) {
      const { error } = await supabase.from('partner_visibility_grants').delete().eq('profile_id', profileId).eq('partner_id', partnerId).eq('section', section)
      if (error) { toast.error('Erro ao revogar acesso.'); setSaving(null); return }
      setGrants(prev => prev.filter(s => s !== section))
    } else {
      const { error } = await supabase.from('partner_visibility_grants').insert({ profile_id: profileId, partner_id: partnerId, section })
      if (error) { toast.error('Erro ao conceder acesso.'); setSaving(null); return }
      setGrants(prev => [...prev, section])

      if (section === 'sensitive_fields') {
        try {
          await keyManager.grantAccessToExisting('profile_sensitive_fields', profileId, partnerUserId)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Autorização salva, mas a chave cifrada ainda não pôde ser compartilhada.')
        }
      }
    }
    setSaving(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Gerenciar acesso"><ShieldCheck className="h-3.5 w-3.5" /></Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Acesso de {partnerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Por padrão, este parceiro só vê o que está público. Conceda acesso explícito para cada seção sensível.
          </p>
          {SECTIONS.map(s => {
            const granted = grants.includes(s.value)
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggle(s.value)}
                disabled={saving === s.value}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  granted ? 'border-primary bg-primary/8' : 'border-border hover:border-foreground'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                {saving === s.value ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <div className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${granted ? 'bg-primary border-primary' : 'border-input'}`}>
                    {granted && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
