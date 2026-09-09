import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { expandSearchTerms } from '@/lib/ai/expand-search-terms'

// Reforço de busca de lançamentos (ver `useTransactionSearch`) — só exige
// login, não passa por `consume_ai_credits`: é custo operacional da busca
// em si, não uma ação de IA cobrada do plano do usuário (mesmo critério
// de `checkTextModeration`, que também nunca gastou crédito).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const query = body?.query
  if (typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ terms: [] })
  }

  // Categorias/descrições reais do próprio usuário, pra ancorar a resposta
  // da IA (ver comentário de `expandSearchTerms`) — nunca de outro perfil,
  // já que quem manda é o próprio client autenticado a partir dos
  // lançamentos que ele já carregou.
  const candidates = Array.isArray(body?.candidates)
    ? body.candidates.filter((c: unknown): c is string => typeof c === 'string')
    : []

  try {
    const terms = await expandSearchTerms(query, candidates)
    return NextResponse.json({ terms })
  } catch (error) {
    // Diferente do resto do fluxo de IA deste app (que debita crédito
    // antes de chamar e por isso não tenta reembolso automático em erro
    // — ver /api/ai/translate), aqui não há nada a reembolsar. O que
    // importa é o `status` não-2xx: é isso que o hook no browser usa pra
    // diferenciar "a IA rodou e não achou nada" (200, `terms: []`) de "a
    // chamada falhou de verdade" (chave ausente, rede, erro do provedor)
    // — ver comentário de `expandSearchTerms` sobre por que não é fail-open
    // aqui dentro.
    console.error('POST /api/ai/expand-search-terms falhou:', error)
    return NextResponse.json({ terms: [], error: 'ai_provider_error' }, { status: 502 })
  }
}
