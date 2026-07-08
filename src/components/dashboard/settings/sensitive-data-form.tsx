'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('SensitiveDataForm')
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
          toast.error(t('errorDecrypt'))
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
      toast.success(t('savedEncrypted'))
    } catch {
      toast.error(t('errorSave'))
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {t('encryptionNotice')}
      </p>
      <div className="space-y-2">
        <Label>{t('realLocation')}</Label>
        <Input value={fields.realLocation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFields(f => ({ ...f, realLocation: e.target.value }))} placeholder={t('realLocationPlaceholder')} />
      </div>
      <div className="space-y-2">
        <Label>{t('itinerary')}</Label>
        <Textarea value={fields.itinerary} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFields(f => ({ ...f, itinerary: e.target.value }))} placeholder={t('itineraryPlaceholder')} rows={3} />
      </div>
      <div className="space-y-2">
        <Label>{t('realName')}</Label>
        <Input value={fields.realName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFields(f => ({ ...f, realName: e.target.value }))} placeholder={t('realNamePlaceholder')} />
      </div>
      <div className="space-y-2">
        <Label>{t('privateNotes')}</Label>
        <Textarea value={fields.privateNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFields(f => ({ ...f, privateNotes: e.target.value }))} rows={3} />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('saveEncrypted')}
      </Button>
    </div>
  )
}
