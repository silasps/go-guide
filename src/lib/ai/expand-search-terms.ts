import { getAnthropicClient } from './client'

const MODEL_SEARCH_EXPAND = 'claude-haiku-4-5'
const MAX_TERMS = 10
const MAX_CANDIDATES = 200

/**
 * Amplia um termo de busca de lançamentos financeiros em palavras/marcas
 * relacionadas em português — reforço usado só quando a busca direta
 * (nome/categoria/data/valor, ver `transaction-search.ts`) não encontra
 * nada.
 *
 * `candidates` são as categorias/descrições REAIS já existentes nos
 * lançamentos dessa pessoa (ver `useTransactionSearch`) — passadas pro
 * modelo como base pra "ancorar" a resposta, em vez de deixar a IA
 * adivinhar sozinha a partir do zero ("free generation"). Pesquisa de
 * recuperação de informação mostra que expansão de consulta sem checar
 * contra o corpus real tende a errar exatamente o termo que já existe
 * (ex.: pedir sinônimo de "filme" sem saber que a categoria "Streaming"
 * já existe faz o modelo sugerir "cinema"/"ingresso" e nunca "Streaming"
 * ou "Netflix", mesmo que o lançamento real esteja bem ali) — daí a
 * lista real ir primeiro no prompt, priorizada sobre a criatividade
 * genérica de marca conhecida.
 *
 * Custo operacional (não consome os créditos de IA do plano do usuário,
 * mesmo espírito de `checkTextModeration`). **Diferente de
 * `checkTextModeration`, essa função NÃO engole erro internamente** — ela
 * deixa a exceção propagar (chave ausente, erro de rede, erro do
 * provedor) e é a rota (`POST /api/ai/expand-search-terms`) que decide o
 * que fazer com isso. Isso é deliberado: uma versão anterior desta função
 * tinha um `try/catch` aqui dentro que devolvia `[]` em qualquer erro —
 * do ponto de vista do hook no browser, isso é IDÊNTICO a "a IA rodou e
 * genuinamente não achou nada relacionado" (a rota respondia 200 do mesmo
 * jeito), mascarando justamente o caso mais comum em dev local — chave
 * ausente — como se fosse uma resposta válida vazia. O fail-open geral da
 * busca continua existindo (ver `useTransactionSearch`), só que agora na
 * camada certa: a chamada de rede que pode falhar de verdade.
 */
export async function expandSearchTerms(query: string, candidates: string[] = []): Promise<string[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const realCandidates = candidates
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .slice(0, MAX_CANDIDATES)

  const client = getAnthropicClient()

  const userContent = realCandidates.length > 0
    ? `Termo buscado: "${trimmed}"\n\nCategorias e descrições REAIS já usadas por essa pessoa nos lançamentos (separadas por vírgula): ${realCandidates.join(', ')}`
    : `Termo buscado: "${trimmed}"`

  const response = await client.messages.create({
    model: MODEL_SEARCH_EXPAND,
    max_tokens: 300,
    system: `Você ajuda a buscar lançamentos financeiros pessoais em português. Você recebe o termo buscado e, quando disponível, uma lista de categorias/descrições REAIS que já existem nos lançamentos dessa pessoa. Primeiro veja se algum item dessa lista real já se relaciona com o termo buscado — se relacionar, inclua esse item exatamente como está escrito na lista, isso é mais confiável do que adivinhar (ex.: se "Streaming" está na lista e o termo buscado é "filme", "Streaming" precisa entrar na resposta). Depois complemente com outras palavras, marcas ou serviços conhecidos no Brasil relacionados ao termo, mesmo que não estejam na lista (ex.: "filme" -> Netflix, HBO Max, Disney+, cinema, ingresso; "remédio" -> farmácia, Droga Raia, Drogasil, drogaria; "roupa" -> camiseta, calça, Renner, C&A). Devolva até 10 termos no total, sem repetir o termo original. Responda apenas com o JSON pedido.`,
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
    messages: [{ role: 'user', content: userContent }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('expand-search-terms: resposta sem bloco de texto')

  const parsed = JSON.parse(block.text) as { terms: string[] }
  return parsed.terms.filter((term) => typeof term === 'string' && term.trim().length > 0).slice(0, MAX_TERMS)
}
