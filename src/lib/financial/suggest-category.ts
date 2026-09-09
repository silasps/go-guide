import { TransactionCategory } from '@/types/database'
import { localRelatedTerms } from './search-synonyms'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

interface HistoryTransaction {
  description: string
  category_id: string | null
  date: string
}

/**
 * Sugere uma categoria pra um lançamento novo a partir da descrição
 * digitada, em duas camadas — nunca obrigatório, a categoria sugerida
 * continua 100% editável no formulário (ver `TransactionForm`):
 *
 * 1. Histórico do próprio usuário: procura nos lançamentos passados uma
 *    descrição igual (normalizada) ou parecida (substring nos dois
 *    sentidos — "Netflix" bate com "Netflix - assinatura mensal") e
 *    reaproveita a categoria usada da última vez. Sinal mais confiável —
 *    é o próprio usuário que ensinou isso ao sistema, não um palpite.
 * 2. Dicionário de sinônimos (`localRelatedTerms`, ver `search-synonyms.ts`):
 *    só entra quando não há histórico nenhum (descrição nova, ex.
 *    "Spotify" pela primeira vez) — relaciona a descrição a alguma
 *    categoria já existente pelo NOME dela (ex. termo relacionado
 *    "streaming" bate com uma categoria chamada "Streaming"). Mais
 *    chutado que o histórico, por isso só é a última tentativa.
 *
 * `categories` deve ser só as categorias elegíveis pro campo (top-level —
 * o formulário não expõe subcategoria nesse select), pra nunca sugerir um
 * id que a lista de opções não tem.
 */
export function suggestCategoryId(
  description: string,
  history: HistoryTransaction[],
  categories: TransactionCategory[]
): string | null {
  const normalizedDescription = normalize(description)
  if (!normalizedDescription) return null

  const withCategory = history.filter((t) => t.category_id)
  const sortByRecent = (a: HistoryTransaction, b: HistoryTransaction) => (a.date < b.date ? 1 : -1)

  const exactMatch = withCategory
    .filter((t) => normalize(t.description) === normalizedDescription)
    .sort(sortByRecent)[0]
  if (exactMatch) return exactMatch.category_id

  const partialMatch = withCategory
    .filter((t) => {
      const d = normalize(t.description)
      return d.includes(normalizedDescription) || normalizedDescription.includes(d)
    })
    .sort(sortByRecent)[0]
  if (partialMatch) return partialMatch.category_id

  const searchTerms = [normalizedDescription, ...localRelatedTerms(description).map(normalize)]
  const matchedCategory = categories.find((c) => {
    const name = normalize(c.name)
    return searchTerms.some((term) => term === name || name.includes(term) || term.includes(name))
  })
  return matchedCategory?.id ?? null
}
