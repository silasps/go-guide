import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateShortLinkCode, shortLinkUrl, shortenWithExternalProvider } from '@/lib/short-links'

// Gera (ou reaproveita) o link curto de um perfil/projeto e, na mesma
// chamada, tenta embrulhar num encurtador externo (TinyURL — ver migration
// 073) enquanto não há domínio curto próprio. Fica em route server-side
// (em vez de mutação direta do client, padrão usado no resto do app)
// porque a chamada ao provedor externo precisa rodar no servidor (CORS) e
// só nesse ponto exato — não é um endpoint genérico de "encurtar qualquer URL".
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const profileId = body?.profileId
  const targetType = body?.targetType
  if (typeof profileId !== 'string' || (targetType !== 'profile' && targetType !== 'project')) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (targetType === 'project' && typeof body.highlightId !== 'string') {
    return NextResponse.json({ error: 'highlightId required' }, { status: 400 })
  }

  const target = targetType === 'project'
    ? { targetType: 'project' as const, highlightId: body.highlightId as string }
    : { targetType: 'profile' as const }

  let code: string
  try {
    // Autorização real acontece aqui: RLS de short_links (is_profile_owner)
    // rejeita se quem chamou não for dono/gestor de profileId, e a trigger
    // rejeita se highlightId não pertencer a profileId — nada disso precisa
    // ser revalidado à mão antes.
    code = await getOrCreateShortLinkCode(supabase, profileId, target)
  } catch (err) {
    const pgErrorCode = (err as { code?: string })?.code
    const status = pgErrorCode === '42501' ? 403 : 500
    return NextResponse.json({ error: 'failed to create short link' }, { status })
  }

  const ownUrl = shortLinkUrl(code)
  const { data: row } = await supabase
    .from('short_links')
    .select('external_short_url')
    .eq('code', code)
    .maybeSingle()

  if (row?.external_short_url) {
    return NextResponse.json({ url: row.external_short_url })
  }

  const externalUrl = await shortenWithExternalProvider(ownUrl)
  if (externalUrl) {
    await supabase.from('short_links').update({ external_short_url: externalUrl }).eq('code', code)
    return NextResponse.json({ url: externalUrl })
  }

  return NextResponse.json({ url: ownUrl })
}
