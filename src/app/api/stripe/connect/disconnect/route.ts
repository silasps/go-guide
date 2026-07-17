import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { getStripeClient } from '@/lib/stripe/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const profile = await getActiveProfile()
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })

  const { data: method } = await supabase
    .from('payment_methods')
    .select('id, value')
    .eq('profile_id', profile.id)
    .eq('type', 'stripe')
    .maybeSingle()

  if (!method) return NextResponse.json({ error: 'not_connected' }, { status: 404 })

  const stripe = getStripeClient()
  if (stripe) {
    // Best-effort — contas Express com saldo/atividade podem recusar a
    // exclusão pela API; removemos localmente de qualquer forma (o
    // missionário pode reconectar depois, o que cria uma conta nova).
    await stripe.accounts.del(method.value).catch(() => {})
  }

  const { error } = await supabase.from('payment_methods').delete().eq('id', method.id)
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
