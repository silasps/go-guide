import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isPluggyConfigured } from '@/lib/open-finance/pluggy'
import { syncOpenFinanceItem } from '@/lib/open-finance/sync'

// Pluggy chama esse endpoint pra avisar de eventos do item (login
// atualizado, transações novas, MFA pendente, etc). Não dá pra validar uma
// assinatura de forma confiável aqui, então o corpo NUNCA é tratado como
// verdade além do itemId — toda mudança de estado vem de buscar o item de
// volta na API da Pluggy com nossas próprias credenciais dentro de
// `syncOpenFinanceItem`. Isso também neutraliza qualquer tentativa de
// forjar um evento pra outro item: na pior das hipóteses, alguém força uma
// sincronização de um item que já é nosso, sem conseguir ver nem alterar
// nada que não pudesse já ver.
export async function POST(req: NextRequest) {
  if (!isPluggyConfigured()) return NextResponse.json({ received: true })

  const body = await req.json().catch(() => null)
  const itemId: string | undefined = body?.itemId ?? body?.data?.item?.id
  if (!itemId) return NextResponse.json({ received: true })

  const supabase = await createServiceClient()
  const { data: itemRow } = await supabase.from('open_finance_items').select('id').eq('pluggy_item_id', itemId).maybeSingle()
  if (!itemRow) return NextResponse.json({ received: true })

  if (body?.event === 'item/deleted') {
    await supabase.from('open_finance_items').delete().eq('id', itemRow.id)
    return NextResponse.json({ received: true })
  }

  try {
    await syncOpenFinanceItem(itemRow.id)
  } catch (err) {
    console.error('[open-finance] webhook sync falhou:', err)
  }

  return NextResponse.json({ received: true })
}
