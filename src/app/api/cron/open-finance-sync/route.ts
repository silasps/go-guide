import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isPluggyConfigured } from '@/lib/open-finance/pluggy'
import { syncOpenFinanceItem } from '@/lib/open-finance/sync'

// Re-sincroniza todo item conectado uma vez por dia — rede de segurança pro
// caso do webhook não disparar (dev local sem URL pública, entrega perdida,
// etc). UPDATING/LOGIN_ERROR também entram: LOGIN_ERROR não busca nada novo
// (early-return dentro de syncOpenFinanceItem), mas relê o status da Pluggy
// a cada execução — útil se o usuário já reconectou por fora sem passar
// pelo widget desta sessão.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isPluggyConfigured()) return NextResponse.json({ skipped: 'not_configured' })

  const supabase = await createServiceClient()
  const { data: items } = await supabase.from('open_finance_items').select('id')

  let synced = 0
  let failed = 0
  for (const item of items ?? []) {
    try {
      await syncOpenFinanceItem(item.id)
      synced += 1
    } catch (err) {
      failed += 1
      console.error(`[open-finance] cron: falha ao sincronizar item ${item.id}:`, err)
    }
  }

  return NextResponse.json({ checked: items?.length ?? 0, synced, failed })
}
