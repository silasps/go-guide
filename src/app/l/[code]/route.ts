import { NextRequest, NextResponse } from 'next/server'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ code: string }>
}

// Redirect curto pra perfil/projeto (bio do Instagram etc.) — ver
// migration 070. Resolve via function SECURITY DEFINER (não lê a tabela
// short_links direto: RLS fecha isso pro dono) que já incrementa o
// clique no mesmo statement.
//
// notFound() (não redirect pra "/") quando o alvo não resolve — mesmo
// comportamento de visitar /[username] ou /[username]/projetos/[slug]
// diretamente pra um perfil privado/stealth ou apagado (getProfileOrRedirect).
export async function GET(request: NextRequest, { params }: Props) {
  const { code } = await params
  const supabase = await createClient()

  const { data: rows } = await supabase.rpc('resolve_short_link', { p_code: code })
  const link = rows?.[0] as { target_type: 'profile' | 'project'; profile_id: string; highlight_id: string | null } | undefined
  if (!link) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', link.profile_id)
    .maybeSingle()
  if (!profile) notFound()

  if (link.target_type === 'profile') {
    return NextResponse.redirect(new URL(`/${profile.username}`, request.url))
  }

  const { data: highlight } = await supabase
    .from('highlights')
    .select('slug')
    .eq('id', link.highlight_id as string)
    .maybeSingle()
  if (!highlight) notFound()

  const slug = highlight.slug ?? link.highlight_id
  return NextResponse.redirect(new URL(`/${profile.username}/projetos/${slug}`, request.url))
}
