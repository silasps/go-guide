import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { isPluggyConfigured, getPluggyClient, pluggyWebhookUrl } from '@/lib/open-finance/pluggy'

// Gera o connectToken de escopo restrito que o widget PluggyConnect usa no
// navegador — nunca a API key completa (essa fica só no servidor). Se
// `itemId` (nosso UUID interno) vier no corpo, é um fluxo de reconexão
// (credenciais expiradas/MFA) — o widget abre em "update mode" pro mesmo
// item já existente na Pluggy, em vez de criar uma conexão nova.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPluggyConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const profile = await getActiveProfile()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { itemId } = await req.json().catch(() => ({}) as { itemId?: string })

  let pluggyItemId: string | undefined
  if (itemId) {
    const { data: row } = await supabase.from('open_finance_items').select('pluggy_item_id').eq('id', itemId).single()
    if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })
    pluggyItemId = row.pluggy_item_id
  }

  try {
    const pluggy = await getPluggyClient()
    const { accessToken } = await pluggy.createConnectToken(pluggyItemId, {
      clientUserId: profile.id,
      webhookUrl: pluggyWebhookUrl(),
      avoidDuplicates: true,
    })
    return NextResponse.json({ accessToken, pluggyItemId: pluggyItemId ?? null })
  } catch (err) {
    console.error('[open-finance] connect-token falhou:', err)
    return NextResponse.json({ error: 'Erro ao gerar token de conexão' }, { status: 502 })
  }
}
