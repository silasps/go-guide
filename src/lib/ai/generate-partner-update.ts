import { getAnthropicClient } from './client'
import { formatCurrency } from '@/lib/utils'

// Sonnet, não Haiku (diferente de translate.ts/moderate-text.ts): aqui o
// que se compra é qualidade de escrita envolvente, não velocidade/custo —
// é o texto que decide se o parceiro lê até o fim ou não.
const MODEL_GENERATE = 'claude-sonnet-5'

export interface PartnerUpdateFinancial {
  periodLabel: string
  incomeByCurrency: Record<string, number>
  expenseByCurrency: Record<string, number>
  topExpenseCategories: { name: string; amount: number; currency: string }[]
}

export type FinancialVisibility = 'exact' | 'percent_only'

export interface PartnerUpdateProject {
  title: string
  goalAmount: number | null
  currentAmount: number
  currency: string
  fundingDeadline: string | null
}

function describeFinancial(f: PartnerUpdateFinancial): string {
  const income = Object.entries(f.incomeByCurrency).map(([c, v]) => formatCurrency(v, c)).join(', ') || 'nada registrado'
  const expense = Object.entries(f.expenseByCurrency).map(([c, v]) => formatCurrency(v, c)).join(', ') || 'nada registrado'
  const top = f.topExpenseCategories.map((c) => `${c.name} (${formatCurrency(c.amount, c.currency)})`).join(', ')
  return [
    `Período: ${f.periodLabel}.`,
    `Total arrecadado: ${income}.`,
    `Total gasto: ${expense}.`,
    top ? `Maiores categorias de gasto: ${top}.` : null,
  ].filter(Boolean).join(' ')
}

// Modo privado: a IA NUNCA recebe os valores em moeda (minimização de
// dado — mais seguro que confiar em instrução de "não fale o valor" no
// prompt, já que o modelo não pode vazar um número que nunca viu). Calcula
// percentuais em TypeScript a partir da moeda dominante (maior total de
// gasto) e descarta o resto — se o missionário movimenta mais de uma
// moeda, só a dominante entra no resumo percentual.
function describeFinancialPercentOnly(f: PartnerUpdateFinancial): string {
  const currencies = Object.entries(f.expenseByCurrency)
  if (currencies.length === 0) return `Período: ${f.periodLabel}. Nenhuma despesa registrada neste período.`

  const [dominantCurrency, totalExpense] = currencies.reduce((a, b) => (b[1] > a[1] ? b : a))
  if (totalExpense <= 0) return `Período: ${f.periodLabel}. Nenhuma despesa registrada neste período.`

  const top = f.topExpenseCategories
    .filter((c) => c.currency === dominantCurrency)
    .map((c) => ({ name: c.name, pct: Math.round((c.amount / totalExpense) * 100) }))
  const others = Math.max(0, 100 - top.reduce((sum, c) => sum + c.pct, 0))

  const breakdown = [...top.map((c) => `${c.name} ${c.pct}%`), others > 0 ? `outras categorias ${others}%` : null]
    .filter(Boolean)
    .join(', ')

  return [
    `Período: ${f.periodLabel}.`,
    `Distribuição proporcional dos gastos (não revele nenhum valor monetário, fale só em termos de proporção/percentual): ${breakdown}.`,
  ].join(' ')
}

function describeProjects(projects: PartnerUpdateProject[]): string {
  return projects.map((p) => {
    const pct = p.goalAmount ? Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100)) : null
    const remaining = p.goalAmount ? Math.max(0, p.goalAmount - p.currentAmount) : null
    const parts = [
      `"${p.title}"`,
      p.goalAmount ? `meta ${formatCurrency(p.goalAmount, p.currency)}` : 'sem meta financeira definida',
      p.goalAmount ? `já arrecadado ${formatCurrency(p.currentAmount, p.currency)} (${pct}%)` : null,
      remaining && remaining > 0 ? `faltam ${formatCurrency(remaining, p.currency)}` : (p.goalAmount ? 'meta já batida' : null),
      p.fundingDeadline ? `prazo ${new Date(p.fundingDeadline).toLocaleDateString('pt-BR')}` : null,
    ].filter(Boolean)
    return `- ${parts.join(', ')}`
  }).join('\n')
}

// Tece o rascunho do missionário + dados financeiros/projetos reais num
// texto único e coeso pra e-mail de atualização — nunca um relatório seco
// de números, sempre narrativa (system.architecture.md 7.10-bis).
export async function generatePartnerUpdate({
  draftText,
  financial,
  financialVisibility = 'exact',
  projects,
}: {
  draftText: string
  financial: PartnerUpdateFinancial | null
  financialVisibility?: FinancialVisibility
  projects: PartnerUpdateProject[]
}): Promise<string> {
  const client = getAnthropicClient()

  const contextParts: string[] = []
  if (draftText.trim()) contextParts.push(`Rascunho escrito pelo missionário (use como base de voz e conteúdo, não substitua):\n${draftText.trim()}`)
  if (financial) {
    const description = financialVisibility === 'percent_only' ? describeFinancialPercentOnly(financial) : describeFinancial(financial)
    contextParts.push(`Dados financeiros reais do período (use pra enriquecer o texto, nunca invente números diferentes destes):\n${description}`)
  }
  if (projects.length) contextParts.push(`Projetos em andamento que precisam de apoio (mencione pelo nome, especialmente os que ainda não bateram a meta):\n${describeProjects(projects)}`)

  const financialPrivacyNote = financialVisibility === 'percent_only'
    ? ' Esta atualização é em modo privado: você não recebeu nenhum valor monetário exato, só proporções — nunca invente ou estime um valor em R$/$/€ para a parte financeira, fale só em termos percentuais ou qualitativos (ex.: "a maior parte foi pra moradia").'
    : ''

  const response = await client.messages.create({
    model: MODEL_GENERATE,
    max_tokens: 1024,
    system: `Você ajuda um missionário a escrever uma atualização por e-mail pra sua rede de parceiros (apoiadores financeiros e de oração). O texto precisa soar pessoal e caloroso, como se o próprio missionário estivesse contando as novidades a um amigo — nunca como um relatório financeiro ou um comunicado corporativo. Teça os números com naturalidade dentro de frases, nunca como uma lista de dados isolada ou tabela. Não use markdown, títulos nem bullet points. Parágrafos curtos, separados por linha em branco. Se houver projetos, um cartão com foto, barra de progresso e botão de cada um já aparece automaticamente logo depois do seu texto — então feche o texto convidando emocionalmente a continuar apoiando ou conhecer mais, sem tentar descrever números exatos de novo nem inventar um link (o botão real já vem a seguir).${financialPrivacyNote} Responda apenas com o JSON pedido.`,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { body: { type: 'string' } },
          required: ['body'],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: 'user', content: contextParts.join('\n\n') || 'Escreva uma atualização breve e calorosa, sem dados específicos.' }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('empty_generation_response')

  return (JSON.parse(block.text) as { body: string }).body
}
