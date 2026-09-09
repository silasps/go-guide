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

  const terms = await expandSearchTerms(query)
  return NextResponse.json({ terms })
}
