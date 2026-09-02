import { formatCurrency } from '@/lib/utils'
import { PartnerUpdateFinancial, PartnerUpdateProject, FinancialVisibility } from '@/lib/ai/generate-partner-update'

// Contraparte sem IA de `generatePartnerUpdate()` (src/lib/ai/generate-partner-update.ts)
// — mesma assinatura/tipos, mas 100% síncrona e determinística (template
// string, sem chamada de rede nem custo). Existe porque `ANTHROPIC_API_KEY`
// nunca teve valor real em nenhum ambiente (ver 7.10-bis) e os blocos de
// prestação de contas/projetos estavam, sem querer, todos atrás do gate de
// IA — isso destrava o recurso pra qualquer missionário, em qualquer plano.
// `describeFinancial`/`describeProjects` daquele arquivo são formatados pro
// CONTEXTO da IA ("Período: X. Total arrecadado: Y."); aqui as frases são
// voltadas pro leitor final (o parceiro), por isso não são reaproveitadas.

function financialParagraph(f: PartnerUpdateFinancial, visibility: FinancialVisibility): string {
  if (visibility === 'percent_only') {
    // Mesma minimização de dado da Fase 1 (ver PercentBreakdown na landing
    // page): esta função NUNCA recebe/usa os valores em moeda aqui dentro,
    // só percentuais já calculados — não é possível vazar o valor exato.
    const currencies = Object.entries(f.expenseByCurrency)
    if (currencies.length === 0) return `Prestação de contas — ${f.periodLabel}\n\nNeste período não tivemos despesas registradas.`
    const [dominantCurrency, total] = currencies.reduce((a, b) => (b[1] > a[1] ? b : a))
    if (total <= 0) return `Prestação de contas — ${f.periodLabel}\n\nNeste período não tivemos despesas registradas.`
    const top = f.topExpenseCategories
      .filter((c) => c.currency === dominantCurrency)
      .map((c) => `${c.name} (${Math.round((c.amount / total) * 100)}%)`)
    const breakdown = top.length ? ` Os principais destinos foram: ${top.join(', ')}.` : ''
    return `Prestação de contas — ${f.periodLabel}\n\nComo sempre, seguimos prestando contas de como usamos o que vocês doam.${breakdown}`
  }

  const income = Object.entries(f.incomeByCurrency).map(([c, v]) => formatCurrency(v, c)).join(', ')
  const expense = Object.entries(f.expenseByCurrency).map(([c, v]) => formatCurrency(v, c)).join(', ')
  const top = f.topExpenseCategories.slice(0, 3).map((c) => c.name)
  const topPhrase = top.length ? `, principalmente com ${top.join(', ')}` : ''
  const incomePart = income ? `recebemos ${income} de apoio` : 'não recebemos nenhuma oferta registrada'
  const expensePart = expense ? `investimos ${expense} na missão${topPhrase}` : 'não tivemos despesas registradas'

  return `Prestação de contas — ${f.periodLabel}\n\nNeste período, ${incomePart} — cada oferta faz toda a diferença! Do que entrou, ${expensePart}. Muito obrigado por caminhar com a gente nisso.`
}

function projectsParagraph(projects: PartnerUpdateProject[]): string {
  const lines = projects.map((p) => {
    if (!p.goalAmount) return `"${p.title}" segue em andamento.`
    const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))
    const remaining = Math.max(0, p.goalAmount - p.currentAmount)
    if (remaining <= 0) return `"${p.title}" já bateu a meta — obrigado por fazer parte disso! 🎉`
    return `"${p.title}" já alcançou ${pct}% da meta (faltam ${formatCurrency(remaining, p.currency)}).`
  })
  return `Projetos em andamento\n\n${lines.join('\n')}`
}

export function generateTemplateUpdate({
  draftText,
  financial,
  financialVisibility = 'exact',
  projects,
}: {
  draftText: string
  financial: PartnerUpdateFinancial | null
  financialVisibility?: FinancialVisibility
  projects: PartnerUpdateProject[]
}): string {
  const parts: string[] = []

  parts.push(draftText.trim() || 'Olá! Passando para compartilhar as novidades por aqui.')
  if (financial) parts.push(financialParagraph(financial, financialVisibility))
  if (projects.length) parts.push(projectsParagraph(projects))
  parts.push('Obrigado por fazer parte dessa caminhada com a gente!')

  return parts.join('\n\n')
}
