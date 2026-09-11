'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Languages, Loader2, Plus, Trash2 } from 'lucide-react'
import { isLocale, orderLocalesByPreference, type Locale } from '@/i18n/config'
import { translateContent, type TranslationSource } from '@/lib/i18n/content-translations'

const LOCALE_FLAGS: Record<Locale, string> = { pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸' }

export interface PrayerPointDraft {
  id?: string
  title: string
  description: string
  is_completed: boolean
  titleTranslations: Partial<Record<Locale, string>>
  titleSources: Partial<Record<Locale, TranslationSource>>
  descriptionTranslations: Partial<Record<Locale, string>>
  descriptionSources: Partial<Record<Locale, TranslationSource>>
}

interface Props {
  points: PrayerPointDraft[]
  onChange: (points: PrayerPointDraft[]) => void
  originalLocale: Locale
  profileId: string
}

/** Mesmo padrão 100% controlado de BudgetCategoriesEditor — sem valor/moeda
 *  (isso é só do lado financeiro), só título + descrição do que orar.
 *
 *  Título e descrição aparecem juntos desde a primeira letra digitada —
 *  antes, "Adicionar" só criava o título e a descrição só surgia depois,
 *  o que dava a impressão de que o ponto de oração já tinha sido criado
 *  (a pedido do usuário, ver Changelog).
 *
 *  Tradução pros outros 2 idiomas segue o mesmo padrão do MilestonesEditor
 *  (botão de idiomas expande um painel por ponto), só que aqui tem 2 campos
 *  pra traduzir (título e descrição) em vez de 1. */
export function PrayerPointsEditor({ points, onChange, originalLocale, profileId }: Props) {
  const t = useTranslations('LocaleContentTabs')
  const tError = useTranslations('PublicProject')
  const detectedLocale = useLocale()
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [translatingKey, setTranslatingKey] = useState<string | null>(null)
  const accountLocale: Locale = isLocale(detectedLocale) ? detectedLocale : originalLocale
  const targetLocales = orderLocalesByPreference(accountLocale).filter((l) => l !== originalLocale)

  function addPoint() {
    onChange([...points, {
      title: '', description: '', is_completed: false,
      titleTranslations: {}, titleSources: {}, descriptionTranslations: {}, descriptionSources: {},
    }])
  }
  function removePoint(idx: number) {
    onChange(points.filter((_, i) => i !== idx))
    if (expandedIdx === idx) setExpandedIdx(null)
  }
  function updatePoint(idx: number, patch: Partial<PrayerPointDraft>) {
    onChange(points.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  function setFieldTranslation(idx: number, field: 'title' | 'description', locale: Locale, value: string) {
    const translationsKey = field === 'title' ? 'titleTranslations' : 'descriptionTranslations'
    const sourcesKey = field === 'title' ? 'titleSources' : 'descriptionSources'
    onChange(points.map((p, i) => i === idx
      ? { ...p, [translationsKey]: { ...p[translationsKey], [locale]: value }, [sourcesKey]: { ...p[sourcesKey], [locale]: 'human' } }
      : p
    ))
  }

  async function translateField(idx: number, field: 'title' | 'description', locale: Locale) {
    const point = points[idx]
    const sourceText = field === 'title' ? point.title : point.description
    if (!sourceText.trim()) return
    const key = `${idx}-${field}-${locale}`
    setTranslatingKey(key)
    try {
      const translated = await translateContent(profileId, originalLocale, locale, sourceText)
      if (translated) {
        const translationsKey = field === 'title' ? 'titleTranslations' : 'descriptionTranslations'
        const sourcesKey = field === 'title' ? 'titleSources' : 'descriptionSources'
        onChange(points.map((p, i) => i === idx
          ? { ...p, [translationsKey]: { ...p[translationsKey], [locale]: translated }, [sourcesKey]: { ...p[sourcesKey], [locale]: 'ai' } }
          : p
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
    <div className="space-y-2 rounded-xl border p-3">
      {points.map((p, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border/60 p-2.5">
          <div className="flex gap-2 items-start">
            <Input
              autoFocus={!p.title && !p.description && i === points.length - 1}
              value={p.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePoint(i, { title: e.target.value })}
              placeholder="Ex: Proteção da equipe em campo"
              className="h-8 text-xs flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 pt-1.5">
              <input
                type="checkbox"
                checked={p.is_completed}
                onChange={(e) => updatePoint(i, { is_completed: e.target.checked })}
                className="rounded border-input"
              />
              Concluído
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={expandedIdx === i ? 'text-primary' : undefined}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              title={t('translateWithAi')}
            >
              <Languages className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePoint(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">O que orar sobre isso</Label>
            <Textarea
              value={p.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePoint(i, { description: e.target.value })}
              placeholder="Ex: Saúde da equipe, segurança nas viagens, disposição pra continuar"
              className="min-h-8 text-xs py-1.5"
              rows={2}
            />
          </div>

          {expandedIdx === i && (
            <div className="space-y-2.5 pt-1 border-t">
              {targetLocales.map((locale) => (
                <div key={locale} className="space-y-2 rounded-md bg-muted/40 p-2">
                  <p className="text-[11px] font-semibold text-foreground">{LOCALE_FLAGS[locale]} {locale.toUpperCase()}</p>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-normal text-muted-foreground">Título</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={p.titleTranslations[locale] ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldTranslation(i, 'title', locale, e.target.value)}
                        placeholder={t('manualPlaceholder')}
                        className="h-7 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={!p.title.trim() || translatingKey !== null}
                        onClick={() => translateField(i, 'title', locale)}
                      >
                        {translatingKey === `${i}-title-${locale}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-normal text-muted-foreground">Descrição (o que orar)</Label>
                    <div className="flex items-start gap-1.5">
                      <Textarea
                        value={p.descriptionTranslations[locale] ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFieldTranslation(i, 'description', locale, e.target.value)}
                        placeholder={t('manualPlaceholder')}
                        className="min-h-8 text-xs py-1.5"
                        rows={2}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={!p.description.trim() || translatingKey !== null}
                        onClick={() => translateField(i, 'description', locale)}
                      >
                        {translatingKey === `${i}-description-${locale}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addPoint} className="gap-1.5 w-full justify-center">
        <Plus className="h-3.5 w-3.5" /> Adicionar ponto de oração
      </Button>
      {points.length === 0 && (
        <Label className="text-xs font-normal text-muted-foreground">Nenhum ponto de oração ainda — opcional, mas ajuda parceiros a orar de forma específica.</Label>
      )}
    </div>
  )
}
