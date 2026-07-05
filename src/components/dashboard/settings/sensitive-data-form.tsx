'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as keyManager from '@/lib/crypto/key-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, ShieldAlert } from 'lucide-react'

interface Props {
  profileId: string
  userId: string
}

interface SensitiveFields {
  realLocation: string
  itinerary: string
  realName: string
  privateNotes: string
}

const EMPTY: SensitiveFields = { realLocation: '', itinerary: '', realName: '', privateNotes: '' }

export function SensitiveDataForm({ profileId, userId }: Props) {
  const [fields, setFields] = useState<SensitiveFields>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('profile_sensitive_data').select('*').eq('profile_id', profileId).maybeSingle()
      if (data) {
        try {
          const plaintext = await keyManager.decryptResource('profile_sensitive_fields', profileId, data.ciphertext, data.nonce)
          setFields({ ...EMPTY, ...JSON.parse(plaintext) })
        } catch {
          toast.error('Não foi possível decifrar seus dados sensíveis salvos anteriormente.')
        }
      }
      setLoading(false)
    }
    load()
  }, [profileId])

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { ciphertext, nonce } = await keyManager.encryptForResource('profile_sensitive_fields', profileId, [userId], JSON.stringify(fields))
      const { error } = await supabase.from('profile_sensitive_data').upsert({ profile_id: profileId, ciphertext, nonce })
      if (error) throw error
      toast.success('Dados sensíveis salvos e cifrados.')
    } catch {
      toast.error('Erro ao salvar.')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Estes campos são cifrados ponta-a-ponta — nem o go_guide consegue lê-los. Só ficam visíveis para você e para parceiros aos quais você conceder acesso explícito em &quot;Acesso&quot; no CRM de parceiros.
      </p>
      <div className="space-y-2">
        <Label>Localização real</Label>
        <Input value={fields.realLocation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFields(f => ({ ...f, realLocation: e.target.value }))} placeholder="Cidade/país real, se diferente do exibido publicamente" />
      </div>
      <div className="space-y-2">
        <Label>Itinerário</Label>
        <Textarea value={fields.itinerary} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFields(f => ({ ...f, itinerary: e.target.value }))} placeholder="Datas e rotas de viagem" rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Nome real</Label>
        <Input value={fields.realName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFields(f => ({ ...f, realName: e.target.value }))} placeholder="Se diferente do nome/alias público" />
      </div>
      <div className="space-y-2">
        <Label>Notas privadas</Label>
        <Textarea value={fields.privateNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFields(f => ({ ...f, privateNotes: e.target.value }))} rows={3} />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar (cifrado)
      </Button>
    </div>
  )
}
