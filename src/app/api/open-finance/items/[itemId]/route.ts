import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isPluggyConfigured, getPluggyClient } from '@/lib/open-finance/pluggy'

// Desconecta um banco: remove o item na Pluggy (best-effort — se já tiver
// sumido lá, ignora e segue) e localmente. As `financial_accounts` vinculadas
// e o histórico de `transactions` já importado NÃO são apagados — só
// deixam de ser "Open Finance" (is_open_finance=false), o usuário continua
// com a conta pra lançar manualmente dali pra frente.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: row } = await supabase.from('open_finance_items').select('id, pluggy_item_id').eq('id', itemId).single()
  if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })

  if (isPluggyConfigured()) {
    try {
      const pluggy = await getPluggyClient()
      await pluggy.deleteItem(row.pluggy_item_id)
    } catch (err) {
      console.error('[open-finance] deleteItem na Pluggy falhou (removendo localmente mesmo assim):', err)
    }
  }

  const admin = await createServiceClient()
  const { data: links } = await admin.from('open_finance_accounts').select('financial_account_id').eq('item_id', itemId)
  const accountIds = (links ?? []).map(l => l.financial_account_id)
  if (accountIds.length > 0) {
    await admin.from('financial_accounts').update({ is_open_finance: false }).in('id', accountIds)
  }
  await admin.from('open_finance_items').delete().eq('id', itemId)

  return NextResponse.json({ ok: true })
}
