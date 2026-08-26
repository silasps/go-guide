'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Circle, Languages, Loader2, Plus, Trash2 } from 'lucide-react'
import { LOCALES, type Locale } from '@/i18n/config'
import { translateContent, type TranslationSource } from '@/lib/i18n/content-translations'

const LOCALE_FLAGS: Record<Locale, string> = { pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸' }

export interface MilestoneDraft {
  id?: string
  title: string
  is_completed: boolean
  translations: Partial<Record<Locale, string>>
  sources: Partial<Record<Locale, TranslationSource>>
}

interface Props {
  milestones: MilestoneDraft[]
  onChange: (milestones: MilestoneDraft[]) => void
  originalLocale: Locale
  profileId: string
}

export function MilestonesEditor({ milestones, onChange, originalLocale, profileId }: Props) {
  const t = useTranslations('LocaleContentTabs')
  const tError = useTranslations('PublicProject')
  const [newMilestone, setNewMilestone] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [translatingKey, setTranslatingKey] = useState<string | null>(null)
  const targetLocales = LOCALES.filter((l) => l !== originalLocale)

  function addMilestone() {
    const title = newMilestone.trim()
    if (!title) return
    onChange([...milestones, { title, is_completed: false, translations: {}, sources: {} }])
    setNewMilestone('')
  }

  function removeMilestone(idx: number) {
    onChange(milestones.filter((_, i) => i !== idx))
    if (expandedIdx === idx) setExpandedIdx(null)
  }

  function toggleMilestone(idx: number) {
    onChange(milestones.map((m, i) => i === idx ? { ...m, is_completed: !m.is_completed } : m))
  }

  function setTranslation(idx: number, locale: Locale, value: string) {
    onChange(milestones.map((m, i) => i === idx
      ? { ...m, translations: { ...m.translations, [locale]: value }, sources: { ...m.sources, [locale]: 'human' } }
      : m
    ))
  }

  async function translate(idx: number, locale: Locale) {
    const milestone = milestones[idx]
    if (!milestone.title.trim()) return
    const key = `${idx}-${locale}`
    setTranslatingKey(key)
    try {
      const translated = await translateContent(profileId, originalLocale, locale, milestone.title)
      if (translated) {
        onChange(milestones.map((m, i) => i === idx
          ? { ...m, translations: { ...m.translations, [locale]: translated }, sources: { ...m.sources, [locale]: 'ai' } }
          : m
        ))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg === 'insufficient_ai_credits' ? tError('insufficientAiCredits') : tError('translateError'))
    } finally {
      setTranslatingKey(null)
    }
  }

  return (
    <div className="space-y-3">
      {milestones.length > 0 && (
        <ul className="space-y-1.5">
          {milestones.map((m, i) => (
            <li key={i} className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <button type="button" onClick={() => toggleMilestone(i)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {m.is_completed
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <Circle className="h-4 w-4" />
                  }
                </button>
                <span className={m.is_completed ? 'line-through text-muted-foreground flex-1' : 'flex-1'}>{m.title}</span>
                <button
                  type="button"
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  className={`shrink-0 transition-colors ${expandedIdx === i ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  title={t('translateWithAi')}
                >
                  <Languages className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => removeMilestone(i)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {expandedIdx === i && (
                <div className="pl-6 space-y-1.5">
                  {targetLocales.map((locale) => (
                    <div key={locale} className="flex items-center gap-1.5">
                      <span className="text-xs shrink-0">{LOCALE_FLAGS[locale]}</span>
                      <Input
                        value={m.translations[locale] ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTranslation(i, locale, e.target.value)}
                        placeholder={t('manualPlaceholder')}
                        className="h-7 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={!m.title.trim() || translatingKey !== null}
                        onClick={() => translate(i, locale)}
                      >
                        {translatingKey === `${i}-${locale}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={newMilestone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMilestone(e.target.value)}
          placeholder="Ex: Fundação concluída"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone() } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={addMilestone}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
