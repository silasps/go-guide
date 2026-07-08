'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LOCALES, type Locale } from '@/i18n/config'

const LOCALE_FLAGS: Record<Locale, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
}

interface Props {
  originalLocale: Locale
  originalText: string
  onOriginalChange: (value: string) => void
  translations: Partial<Record<Locale, string>>
  onTranslationChange: (locale: Locale, value: string) => void
  onTranslateWithAi: (locale: Locale) => Promise<void>
  rows?: number
  maxLength?: number
  originalPlaceholder?: string
  /** Idioma da conta (Configurações → Conta). A aba aberta por padrão prioriza esse
   *  idioma em vez do idioma original do conteúdo — quem navega o painel em EN espera
   *  abrir a aba EN primeiro, mesmo que o texto original tenha sido escrito em outro idioma. */
  preferredLocale?: Locale
}

export function LocaleContentTabs({
  originalLocale,
  originalText,
  onOriginalChange,
  translations,
  onTranslationChange,
  onTranslateWithAi,
  rows = 5,
  maxLength,
  originalPlaceholder,
  preferredLocale,
}: Props) {
  const [activeTab, setActiveTab] = useState<Locale>(preferredLocale ?? originalLocale)
  const [translating, setTranslating] = useState<Locale | null>(null)

  async function handleTranslate(locale: Locale) {
    setTranslating(locale)
    try {
      await onTranslateWithAi(locale)
    } finally {
      setTranslating(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {LOCALES.map((locale) => {
          const hasContent = locale === originalLocale ? !!originalText.trim() : !!translations[locale]?.trim()
          return (
            <button
              key={locale}
              type="button"
              onClick={() => setActiveTab(locale)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-opacity',
                activeTab === locale ? 'opacity-100 ring-1 ring-foreground/15' : 'opacity-50 hover:opacity-80'
              )}
            >
              <span>{LOCALE_FLAGS[locale]}</span>
              <span className={cn('h-1.5 w-1.5 rounded-full', hasContent ? 'bg-emerald-500' : 'bg-foreground/20')} />
            </button>
          )
        })}
      </div>

      {LOCALES.map((locale) => {
        if (locale !== activeTab) return null
        const isOriginal = locale === originalLocale
        return (
          <div key={locale} className="space-y-2">
            {isOriginal ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!originalText.trim() || translating !== null}
                onClick={() => handleTranslate(locale)}
              >
                {translating === locale ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Traduzir com IA
              </Button>
            )}
            <Textarea
              rows={rows}
              maxLength={maxLength}
              value={isOriginal ? originalText : translations[locale] ?? ''}
              onChange={(e) => (isOriginal ? onOriginalChange(e.target.value) : onTranslationChange(locale, e.target.value))}
              placeholder={isOriginal ? originalPlaceholder : 'Digite a tradução manualmente, ou use o botão acima'}
            />
          </div>
        )
      })}
    </div>
  )
}
