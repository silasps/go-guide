import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile/get-profile'
import { PartnershipWizard } from '@/components/partners/partnership-wizard'
import { getPartnershipData } from '@/lib/partners/get-partnership-data'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ highlight_id?: string; choice?: string; category?: string }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { username } = await params
  const { highlight_id } = await searchParams
  const profile = await getProfile(username)
  if (!profile || profile.privacy_mode === 'stealth') return {}

  const t = await getTranslations('PublicProfile')
  const isIndexable = profile.privacy_mode === 'public'

  // Link de um projeto específico ("apoiar essa viagem") mostra a capa e o
  // título do projeto — não faz sentido só o avatar do missionário aqui,
  // quem recebe o link quer saber PRA QUE está contribuindo.
  let highlight: { title: string; cover_url: string | null } | null = null
  if (highlight_id) {
    const supabase = await createClient()
    const { data } = await supabase.from('highlights').select('title, cover_url').eq('id', highlight_id).eq('profile_id', profile.id).maybeSingle()
    highlight = data
  }

  const title = highlight
    ? t('partnershipHighlightTitle', { title: highlight.title, name: profile.display_name })
    : t('partnershipTitle', { name: profile.display_name })
  const description = profile.bio ?? undefined
  const image = highlight?.cover_url ?? profile.avatar_url

  return {
    title,
    description,
    openGraph: isIndexable ? { title, description: description ?? '', images: image ? [image] : [] } : undefined,
    robots: isIndexable ? undefined : { index: false, follow: false },
  }
}

export default async function ParceriaPage({ params, searchParams }: Props) {
  const { username } = await params
  const data = await getPartnershipData(username, await searchParams)
  if (!data) notFound()

  return <PartnershipWizard {...data} />
}
