import { Suspense } from 'react'
import { ProfileTabs } from '@/components/profile/profile-tabs'
import { Sk } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile/get-profile'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'

interface Props {
  children: React.ReactNode
  modal: React.ReactNode
  params: Promise<{ username: string }>
}

function NavSkeleton() {
  return (
    <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b h-[49px] flex items-center px-4">
      <Sk className="h-4 w-32" />
    </div>
  )
}

// A barra de abas (ProfileTabs) precisa de dados que levam alguns round-trips
// ao banco (perfil, contagem de trajetória, contexto de quem está vendo).
// Isolamos isso numa Suspense própria, com {children} como IRMÃO fora dela,
// para que a página em si (já coberta pelo loading.tsx da pasta) comece a
// renderizar/streamar sem esperar a navegação resolver — essa era a causa
// da tela ficar em branco: antes, esses awaits bloqueavam tudo, inclusive
// {children}, e loading.tsx só cobre page.tsx, nunca este layout.
async function ProfileTabsAsync({ username }: { username: string }) {
  const [profile, { canEdit, viewerUserId }] = await Promise.all([
    getProfile(username),
    getProfileViewerContext(username),
  ])

  let hasTrajectory = false
  if (profile) {
    const supabase = await createClient()
    const { count } = await supabase
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('status', 'completed')
      .is('archived_at', null)
    hasTrajectory = (count ?? 0) > 0
  }

  return (
    <ProfileTabs
      username={username}
      hasTrajectory={hasTrajectory}
      isMissionary={profile?.user_role === 'missionary'}
      canEdit={canEdit}
      viewerUserId={viewerUserId}
      ownerProfile={profile ?? null}
    />
  )
}

export default async function UsernameLayout({ children, modal, params }: Props) {
  const { username } = await params

  return (
    <>
      <Suspense fallback={<NavSkeleton />}>
        <ProfileTabsAsync username={username} />
      </Suspense>
      {children}
      {modal}
    </>
  )
}
