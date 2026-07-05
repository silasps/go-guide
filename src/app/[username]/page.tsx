import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProjectsSection } from '@/components/profile/projects-section'
import { ProfileCTA } from '@/components/profile/profile-cta'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url, privacy_mode')
    .eq('username', username)
    .single()

  if (!profile) return { title: 'Perfil não encontrado' }

  const isIndexable = profile.privacy_mode === 'public'

  return {
    title: profile.privacy_mode === 'stealth' ? 'Missionário' : profile.display_name,
    description: profile.bio ?? undefined,
    openGraph: isIndexable
      ? {
          title: profile.display_name,
          description: profile.bio ?? '',
          images: profile.avatar_url ? [profile.avatar_url] : [],
        }
      : undefined,
    robots: isIndexable ? undefined : { index: false, follow: false },
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) notFound()

  if (profile.privacy_mode === 'private') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <PrivateProfileScreen name={profile.display_name} />
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('user_id', user.id)
      .single()
    if (!partner) return <PrivateProfileScreen name={profile.display_name} />
  }

  const { data: projects } = await supabase
    .from('highlights')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('status', 'active')
    .order('order_index')

  const { count: completedCount } = await supabase
    .from('highlights')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('status', 'completed')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        <ProfileHeader profile={profile} />
        <ProfileCTA username={profile.username} hasTrajectory={(completedCount ?? 0) > 0} />
        {projects && projects.length > 0 && (
          <ProjectsSection projects={projects} username={profile.username} accentColor={profile.accent_color} />
        )}
      </div>
    </div>
  )
}

function PrivateProfileScreen({ name }: { name: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="text-muted-foreground text-sm">
          Este perfil é privado. Entre em contato com o missionário para solicitar acesso.
        </p>
      </div>
    </div>
  )
}
