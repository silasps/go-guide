import { getAnthropicClient } from './client'

const MODEL_MODERATE = 'claude-haiku-4-5'

const MODERATION_CATEGORIES = ['hate_speech', 'sexual_content', 'harassment', 'violence', 'none'] as const

export interface TextModerationResult {
  flagged: boolean
  categories: string[]
}

/** Classifica texto de post/comentário antes de publicar. Fail-open: erro
 *  ou timeout na chamada deixa passar (não trava publicação por
 *  instabilidade do provedor) — mesmo espírito de sendEmail() retornando
 *  false em silêncio quando a integração não está disponível. */
export async function checkTextModeration(text: string): Promise<TextModerationResult> {
  try {
    const client = getAnthropicClient()

    const response = await client.messages.create({
      model: MODEL_MODERATE,
      max_tokens: 256,
      system: `Você modera conteúdo de uma rede social cristã voltada a missionários e parceiros. Classifique o texto do usuário em uma ou mais categorias: hate_speech (discurso de ódio, discriminação), sexual_content (conteúdo sexual/pornográfico explícito), harassment (assédio, ameaça, humilhação direcionada), violence (incitação à violência), ou none (nenhuma delas). Responda apenas com o JSON pedido.`,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              categories: { type: 'array', items: { type: 'string', enum: [...MODERATION_CATEGORIES] } },
            },
            required: ['categories'],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: text }],
    })

    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return { flagged: false, categories: [] }

    const parsed = JSON.parse(block.text) as { categories: string[] }
    const categories = parsed.categories.filter((c) => c !== 'none')
    return { flagged: categories.length > 0, categories }
  } catch (error) {
    console.error('checkTextModeration falhou, deixando passar (fail-open):', error)
    return { flagged: false, categories: [] }
  }
}
