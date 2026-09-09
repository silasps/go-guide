import { getAnthropicClient } from './client'

const MODEL_SEARCH_EXPAND = 'claude-haiku-4-5'
const MAX_TERMS = 10

/**
 * Amplia um termo de busca de lançamentos financeiros em palavras/marcas
 * relacionadas em português — reforço usado só quando a busca direta
 * (nome/categoria/data/valor, ver `transaction-search.ts`) não encontra
 * nada. Vai além de sinônimo: pensa em como o lançamento apareceria de
 * verdade na lista (geralmente nome de loja/marca/serviço, não uma
 * descrição genérica). Ex.: "roupa" -> camiseta, calça, Renner, C&A;
 * "filme" -> Netflix, HBO Max, Disney+, streaming, cinema; "remédio" ->
 * farmácia, Droga Raia, Drogasil, drogaria.
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
      system: `Você ajuda a buscar lançamentos financeiros pessoais em português (nome de quem foi pago, o que foi comprado). Dado um termo de busca, pense em como esse lançamento apareceria de verdade numa lista de gastos/receitas — geralmente é o nome de uma loja, marca ou serviço, não uma descrição genérica — e devolva até 10 palavras ou nomes relacionados em português que ajudariam a achar esse lançamento mesmo que a descrição real seja bem diferente do termo buscado. Inclua sinônimos, itens típicos do mesmo assunto E marcas/empresas conhecidas no Brasil pra esse assunto, sempre que fizer sentido. Exemplos: "roupa" -> camiseta, calça, blusa, sapato, vestido, jaqueta, moletom, casaco, Renner, C&A, Zara; "filme" -> Netflix, HBO Max, Disney+, Amazon Prime, streaming, cinema, ingresso; "remédio" -> farmácia, Droga Raia, Drogasil, Pacheco, drogaria, medicamento. Não repita o termo original. Responda apenas com o JSON pedido.`,
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
