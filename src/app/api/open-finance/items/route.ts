import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { isPluggyConfigured, getPluggyClient } from '@/lib/open-finance/pluggy'
import { syncOpenFinanceItem } from '@/lib/open-finance/sync'

// Chamado pelo cliente logo após o `onSuccess` do widget PluggyConnect,
// pra registrar o item e disparar a primeira sincronização (cria as
// `financial_accounts` e importa os lançamentos). Também cobre o fluxo de
// reconexão (mesmo pluggy_item_id, upsert atualiza o registro existente).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPluggyConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const profile = await getActiveProfile()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { pluggyItemId } = await req.json().catch(() => ({}) as { pluggyItemId?: string })
  if (!pluggyItemId) return NextResponse.json({ error: 'pluggyItemId obrigatório' }, { status: 400 })

  let item
  try {
    const pluggy = await getPluggyClient()
    item = await pluggy.fetchItem(pluggyItemId)
  } catch (err) {
    console.error('[open-finance] fetchItem falhou:', err)
    return NextResponse.json({ error: 'Erro ao consultar conexão na Pluggy' }, { status: 502 })
  }

  // Nunca confiar no itemId só porque o cliente mandou: o item só é aceito
  // se tiver sido criado com o connectToken DESTE perfil (clientUserId) —
  // senão qualquer usuário autenticado poderia vincular à força a conexão
  // bancária de outro perfil só reaproveitando/adivinhando um itemId.
  if (item.clientUserId !== profile.id) {
    return NextResponse.json({ error: 'Item não pertence a este perfil' }, { status: 403 })
  }

  const admin = await createServiceClient()
  const { data: itemRow, error } = await admin.from('open_finance_items').upsert({
    profile_id: profile.id,
    created_by_user_id: user.id,
    pluggy_item_id: item.id,
    connector_id: item.connector.id,
    connector_name: item.connector.name,
    connector_image_url: item.connector.imageUrl,
    status: item.status,
  }, { onConflict: 'pluggy_item_id' }).select('id').single()

  if (error || !itemRow) return NextResponse.json({ error: 'Erro ao registrar conexão' }, { status: 500 })

  try {
    await syncOpenFinanceItem(itemRow.id)
  } catch (err) {
    console.error('[open-finance] sync inicial falhou:', err)
  }

  return NextResponse.json({ ok: true, itemId: itemRow.id })
}
