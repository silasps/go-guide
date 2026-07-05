import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function assertOwnsAccount(accountId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('financial_accounts')
    .select('id, profile:profiles!inner(user_id)')
    .eq('id', accountId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!data && (data as any).profile?.user_id === userId
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { accountId, email, role } = await req.json()
  if (!(await assertOwnsAccount(accountId, user.id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = await createServiceClient()
  let targetUserId: string | null = null
  let page = 1
  while (!targetUserId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const found = data.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase())
    if (found) { targetUserId = found.id; break }
    if (data.users.length < 200) break
    page++
  }

  if (!targetUserId) {
    return NextResponse.json({ error: 'Nenhum usuário encontrado com esse e-mail. A pessoa precisa ter uma conta no go_guide.' }, { status: 404 })
  }

  const { error } = await admin.from('account_members').insert({
    account_id: accountId,
    user_id: targetUserId,
    role: role === 'owner' ? 'owner' : 'viewer',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { memberId, accountId } = await req.json()
  if (!(await assertOwnsAccount(accountId, user.id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = await createServiceClient()
  const { error } = await admin.from('account_members').delete().eq('id', memberId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
