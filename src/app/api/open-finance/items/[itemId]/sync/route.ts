import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncOpenFinanceItem } from '@/lib/open-finance/sync'

// Botão "Sincronizar agora" no dialog de gerenciamento.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: row } = await supabase.from('open_finance_items').select('id').eq('id', itemId).single()
  if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })

  try {
    const result = await syncOpenFinanceItem(itemId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[open-finance] sync manual falhou:', err)
    return NextResponse.json({ error: 'Erro ao sincronizar' }, { status: 502 })
  }
}
