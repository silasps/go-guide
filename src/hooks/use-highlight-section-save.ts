'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

/** Salva uma seção editável de highlight via POST /api/highlights e força um refresh do Server Component, para que as demais seções recebam um snapshot atualizado (evita que uma edição em sequência sobrescreva a anterior com dados desatualizados). */
export function useHighlightSectionSave() {
  const router = useRouter()
  const t = useTranslations('PublicProject')
  const [saving, setSaving] = useState(false)

  async function save(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? t('saveError'))
      }
      toast.success(t('saved'))
      router.refresh()
      return true
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('saveError'))
      return false
    } finally {
      setSaving(false)
    }
  }

  return { saving, save }
}
