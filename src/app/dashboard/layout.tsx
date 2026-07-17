import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile, getAccessibleProfiles } from '@/lib/profile/active-profile'
import { DashboardSidebar, MobileBottomNav, MobileHeader } from '@/components/dashboard/sidebar'
import { CreateContentFab } from '@/components/dashboard/create-content-fab'
import { NotificationsBell } from '@/components/dashboard/notifications-bell'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profile, accessibleProfiles] = await Promise.all([
    getActiveProfile(),
    getAccessibleProfiles(),
  ])

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar profile={profile} accessibleProfiles={accessibleProfiles} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 md:h-12 border-b grid grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 shrink-0">
          <div />
          <MobileHeader profile={profile} />
          <div className="flex items-center gap-1 justify-self-end">
            <ThemeToggle />
            <NotificationsBell userId={user.id} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {/* max-w-5xl keeps content readable on ultrawide screens */}
          <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav profile={profile} />
      <CreateContentFab role={profile.user_role} />
    </div>
  )
}
