import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function addOneMonth(date: string) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

// Materializa `recurring_transactions` vencidas em `transactions` reais
// (system.architecture.md 3.1) — diferente de `recurring-reminders/route.ts`
// (que só lembra o PARCEIRO de pagar por fora), aqui é dinheiro do próprio
// missionário: não precisa de confirmação de ninguém, só cria o
// lançamento sozinho. `update_account_balance()` (trigger existente,
// dispara em INSERT) atualiza o saldo da conta sozinho.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: due } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .lte('next_due_date', today)

  let generated = 0
  for (const rt of due ?? []) {
    const { error: insertError } = await supabase.from('transactions').insert({
      account_id: rt.account_id,
      profile_id: rt.profile_id,
      created_by_user_id: rt.created_by_user_id,
      type: rt.type,
      amount: rt.amount,
      currency: rt.currency,
      description: rt.description,
      category_id: rt.category_id,
      source: 'recurring',
      date: rt.next_due_date,
    })

    if (!insertError) {
      generated += 1
      await supabase.from('recurring_transactions').update({ next_due_date: addOneMonth(rt.next_due_date) }).eq('id', rt.id)
    }
  }

  return NextResponse.json({ checked: due?.length ?? 0, generated })
}
