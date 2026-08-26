'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { EditPencilButton, EditActions } from './edit-section-chrome'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import { LocaleContentTabs } from '@/components/dashboard/locale-content-tabs'
import { initialTranslations, initialSources, buildTranslationsPayload, translateContent } from '@/lib/i18n/content-translations'
import type { Locale } from '@/i18n/config'
import type { SectionProps } from './section-types'

export function LetterEditSection({ canEdit, snapshot, highlightId, profileId, children }: SectionProps) {
  const t = useTranslations('PublicProject')
  const { saving, save } = useHighlightSectionSave()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(snapshot.letter)
  const [translations, setTranslations] = useState(() => initialTranslations(snapshot.letterTranslations))
  const [sources, setSources] = useState(() => initialSources(snapshot.letterTranslations))

  async function translateField(locale: Locale) {
    try {
      const translated = await translateContent(profileId, snapshot.originalLocale, locale, value)
      if (translated) {
        setTranslations((prev) => ({ ...prev, [locale]: translated }))
        setSources((prev) => ({ ...prev, [locale]: 'ai' }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg === 'insufficient_ai_credits' ? t('insufficientAiCredits') : t('translateError'))
    }
  }

  if (!canEdit) return <>{children}</>

  if (!editing) {
    return (
      <div className="group relative">
        {children}
        <EditPencilButton
          label={t('editSection', { section: t('sectionLetter') })}
          onClick={() => {
            setValue(snapshot.letter)
            setTranslations(initialTranslations(snapshot.letterTranslations))
            setSources(initialSources(snapshot.letterTranslations))
            setEditing(true)
          }}
        />
      </div>
    )
  }

  async function handleSave() {
    const ok = await save({
      ...snapshot,
      highlightId,
      profileId,
      letter: value,
      letterTranslations: buildTranslationsPayload(snapshot.originalLocale, translations, sources),
    })
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <LocaleContentTabs
        originalLocale={snapshot.originalLocale}
        originalText={value}
        onOriginalChange={setValue}
        translations={translations}
        onTranslationChange={(locale, text) => { setTranslations((prev) => ({ ...prev, [locale]: text })); setSources((prev) => ({ ...prev, [locale]: 'human' })) }}
        onTranslateWithAi={translateField}
        rows={8}
      />
      <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={handleSave} cancelLabel={t('cancel')} saveLabel={t('save')} />
    </div>
  )
}
