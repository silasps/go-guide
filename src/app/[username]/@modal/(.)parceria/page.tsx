import { notFound } from 'next/navigation'
import { PartnershipModal } from '@/components/partners/partnership-modal'
import { getPartnershipData } from '@/lib/partners/get-partnership-data'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ highlight_id?: string; choice?: string; category?: string }>
}

export default async function ParceriaModalPage({ params, searchParams }: Props) {
  const { username } = await params
  const data = await getPartnershipData(username, await searchParams)
  if (!data) notFound()

  return <PartnershipModal {...data} />
}
