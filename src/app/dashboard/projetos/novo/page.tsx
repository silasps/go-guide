import { getActiveProfile } from '@/lib/profile/active-profile'
import { ProjectEditorModal } from '@/components/highlights/project-editor-modal'

export default async function NovoProjetoPage() {
  const profile = await getActiveProfile()

  return (
    <ProjectEditorModal mode="create" profileId={profile!.id} backPath={`/${profile!.username}/projetos`} />
  )
}
