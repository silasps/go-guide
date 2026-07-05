import { getActiveProfile } from '@/lib/profile/active-profile'
import { HighlightForm } from '@/components/highlights/highlight-form'

export default async function NovoDestaquePage() {
  const profile = await getActiveProfile()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Novo destaque</h1>
      <HighlightForm profileId={profile!.id} />
    </div>
  )
}
