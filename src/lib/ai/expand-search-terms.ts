import { getAnthropicClient } from './client'

const MODEL_SEARCH_EXPAND = 'claude-haiku-4-5'
const MAX_TERMS = 8

/**
 * Amplia um termo de busca de lançamentos financeiros em palavras
 * relacionadas em português (sinônimos, itens típicos, jeitos alternativos
 * de escrever) — reforço usado só quando a busca direta (nome/categoria/
 * data/valor, ver `transaction-search.ts`) não encontra nada. Ex.: "roupa"
 * -> camiseta, calça, blusa, sapato, vestido.
 *
 * Custo operacional (não consome os créditos de IA do plano do usuário,
 * mesmo espírito de `checkTextModeration`). Fail-open: erro ou timeout
 * devolve lista vazia — a busca cai de volta pro filtro direto sem
 * quebrar nada.
 */
export async function expandSearchTerms(query: string): Promise<string[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  try {
    const client = getAnthropicClient()

    const response = await client.messages.create({
      model: MODEL_SEARCH_EXPAND,
      max_tokens: 256,
      system: `Você ajuda a buscar lançamentos financeiros pessoais em português. Dado um termo de busca, devolva palavras relacionadas em português (sinônimos, itens típicos daquela categoria, formas alternativas de escrever) que ajudariam a achar um lançamento com descrição diferente do termo, mas do mesmo assunto. Exemplo: para "roupa", devolva algo como camiseta, calça, blusa, sapato, vestido, jaqueta, moletom, casaco. Não repita o termo original. Responda apenas com o JSON pedido.`,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              terms: { type: 'array', items: { type: 'string' } },
            },
            required: ['terms'],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: trimmed }],
    })

    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return []

    const parsed = JSON.parse(block.text) as { terms: string[] }
    return parsed.terms.filter((term) => typeof term === 'string' && term.trim().length > 0).slice(0, MAX_TERMS)
  } catch (error) {
    console.error('expandSearchTerms falhou, caindo pra busca direta (fail-open):', error)
    return []
  }
}
