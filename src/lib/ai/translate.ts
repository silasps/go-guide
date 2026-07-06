import { getAnthropicClient } from './client'
import type { Locale } from '@/types/database'

const MODEL_TRANSLATE = 'claude-haiku-4-5'

const LOCALE_NAMES: Record<Locale, string> = {
  pt: 'português',
  en: 'inglês',
  es: 'espanhol',
}

export async function translateContent({
  text,
  sourceLocale,
  targetLocales,
}: {
  text: string
  sourceLocale: Locale
  targetLocales: Locale[]
}): Promise<Partial<Record<Locale, string>>> {
  const client = getAnthropicClient()

  const response = await client.messages.create({
    model: MODEL_TRANSLATE,
    max_tokens: 2048,
    system: `Você é um tradutor profissional. Traduza o texto do usuário, escrito em ${LOCALE_NAMES[sourceLocale]}, para os idiomas pedidos, preservando tom, formatação e quebras de linha. Responda apenas com o JSON pedido.`,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: Object.fromEntries(targetLocales.map((locale) => [locale, { type: 'string' }])),
          required: targetLocales,
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: 'user', content: text }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('empty_translation_response')

  return JSON.parse(block.text) as Partial<Record<Locale, string>>
}
