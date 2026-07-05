import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getOwnedHighlight(highlightId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('highlights')
    .select('id, profile_id, title, currency, profile:profiles!inner(user_id)')
    .eq('id', highlightId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!data || (data as any).profile?.user_id !== userId) return null
  return data
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { highlightId, email, role } = await req.json()
  const highlight = await getOwnedHighlight(highlightId, user.id)
  if (!highlight) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

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

  const memberRole = role === 'lead' ? 'lead' : role === 'viewer' ? 'viewer' : 'member'
  const { error: memberError } = await admin.from('project_members').insert({
    highlight_id: highlightId,
    user_id: targetUserId,
    role: memberRole,
    invited_by_user_id: user.id,
  })
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // Garante que existe uma conta financeira do projeto e sincroniza o acesso ao dinheiro.
  let { data: account } = await admin
    .from('financial_accounts')
    .select('id')
    .eq('highlight_id', highlightId)
    .maybeSingle()

  if (!account) {
    const { data: created, error: accError } = await admin.from('financial_accounts').insert({
      profile_id: highlight.profile_id,
      highlight_id: highlightId,
      currency_code: highlight.currency ?? 'BRL',
      name: `Equipe — ${highlight.title}`,
      is_shared: true,
      created_by_user_id: user.id,
    }).select('id').single()
    if (accError) return NextResponse.json({ error: accError.message }, { status: 500 })
    account = created
  }

  if (account) {
    await admin.from('account_members').insert({
      account_id: account.id,
      user_id: targetUserId,
      role: memberRole === 'lead' ? 'owner' : 'viewer',
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { memberId, highlightId, memberUserId } = await req.json()
  const highlight = await getOwnedHighlight(highlightId, user.id)
  if (!highlight) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = await createServiceClient()
  await admin.from('project_members').delete().eq('id', memberId)

  const { data: account } = await admin.from('financial_accounts').select('id').eq('highlight_id', highlightId).maybeSingle()
  if (account && memberUserId) {
    await admin.from('account_members').delete().eq('account_id', account.id).eq('user_id', memberUserId)
  }

  return NextResponse.json({ ok: true })
}
