import { createTranslator } from 'next-intl'
import { formatCurrency } from '@/lib/utils'
import { PartnerUpdateFinancial, PartnerUpdateProject, FinancialVisibility } from '@/lib/ai/generate-partner-update'
import type { Locale } from '@/types/database'

// Contraparte sem IA de `generatePartnerUpdate()` (src/lib/ai/generate-partner-update.ts)
// — mesma assinatura/tipos, mas 100% síncrona e determinística (template
// string, sem chamada de rede nem custo). Existe porque `ANTHROPIC_API_KEY`
// nunca teve valor real em nenhum ambiente (ver 7.10-bis) e os blocos de
// prestação de contas/projetos estavam, sem querer, todos atrás do gate de
// IA — isso destrava o recurso pra qualquer missionário, em qualquer plano.
// `describeFinancial`/`describeProjects` daquele arquivo são formatados pro
// CONTEXTO da IA ("Período: X. Total arrecadado: Y."); aqui as frases são
// voltadas pro leitor final (o parceiro), por isso não são reaproveitadas.
//
// i18n: usa `createTranslator` com import direto de `messages/{locale}.json`
// (mesmo padrão de `src/i18n/request.ts:75`) em vez de `getTranslations()`
// — esta função roda dentro de uma rota de API (sem locale de URL), então
// resolver o locale de forma explícita e sem depender de contexto de
// requisição é mais robusto.

async function loadTemplateTranslator(locale: Locale) {
  const messages = (await import(`../../../messages/${locale}.json`)).default
  return createTranslator({ locale, messages, namespace: 'PartnerUpdateTemplate' })
}

async function financialParagraph(f: PartnerUpdateFinancial, visibility: FinancialVisibility, locale: Locale): Promise<string> {
  const t = await loadTemplateTranslator(locale)
  const heading = t('reportHeading', { period: f.periodLabel })

  if (visibility === 'percent_only') {
    // Mesma minimização de dado da Fase 1 (ver PercentBreakdown na landing
    // page): esta função NUNCA recebe/usa os valores em moeda aqui dentro,
    // só percentuais já calculados — não é possível vazar o valor exato.
    const currencies = Object.entries(f.expenseByCurrency)
    if (currencies.length === 0 || currencies.reduce((a, b) => (b[1] > a[1] ? b : a))[1] <= 0) {
      return `${heading}\n\n${t('noExpenses')}`
    }
    const [dominantCurrency, total] = currencies.reduce((a, b) => (b[1] > a[1] ? b : a))
    const top = f.topExpenseCategories
      .filter((c) => c.currency === dominantCurrency)
      .map((c) => `${c.name} (${Math.round((c.amount / total) * 100)}%)`)
    const body = top.length ? t('percentOnlyWithBreakdown', { list: top.join(', ') }) : t('percentOnlyNoBreakdown')
    return `${heading}\n\n${body}`
  }

  const income = Object.entries(f.incomeByCurrency).map(([c, v]) => formatCurrency(v, c)).join(', ')
  const expense = Object.entries(f.expenseByCurrency).map(([c, v]) => formatCurrency(v, c)).join(', ')
  const top = f.topExpenseCategories.slice(0, 3).map((c) => c.name)

  const incomePart = income ? t('incomeReceived', { income }) : t('incomeNone')
  const expensePart = !expense ? t('expenseNone') : (top.length ? t('expenseWithTop', { expense, categories: top.join(', ') }) : t('expensePlain', { expense }))

  return `${heading}\n\n${t('exactBody', { incomePart, expensePart })}`
}

function projectsParagraph(projects: PartnerUpdateProject[], t: Awaited<ReturnType<typeof loadTemplateTranslator>>): string {
  const lines = projects.map((p) => {
    if (!p.goalAmount) return t('projectOngoing', { title: p.title })
    const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))
    const remaining = Math.max(0, p.goalAmount - p.currentAmount)
    if (remaining <= 0) return t('projectGoalReached', { title: p.title })
    return t('projectProgress', { title: p.title, pct, remaining: formatCurrency(remaining, p.currency) })
  })
  return `${t('projectsHeading')}\n\n${lines.join('\n')}`
}

export async function generateTemplateUpdate({
  draftText,
  financial,
  financialVisibility = 'exact',
  projects,
  locale = 'pt',
}: {
  draftText: string
  financial: PartnerUpdateFinancial | null
  financialVisibility?: FinancialVisibility
  projects: PartnerUpdateProject[]
  locale?: Locale
}): Promise<string> {
  const t = await loadTemplateTranslator(locale)
  const parts: string[] = []

  parts.push(draftText.trim() || t('defaultDraft'))
  if (financial) parts.push(await financialParagraph(financial, financialVisibility, locale))
  if (projects.length) parts.push(projectsParagraph(projects, t))
  parts.push(t('closing'))

  return parts.join('\n\n')
}
