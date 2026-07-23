import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile, getAccessibleProfiles } from '@/lib/profile/active-profile'
import { getPreviewRole } from '@/lib/profile/role-preview'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { DashboardSidebar, MobileBottomNav, MobileHeader } from '@/components/dashboard/sidebar'
import { HeaderSearch } from '@/components/dashboard/header-search'
import { CreateContentFab } from '@/components/dashboard/create-content-fab'
import { NotificationsBell } from '@/components/dashboard/notifications-bell'
import { SuperadminRoleSwitcher } from '@/components/dashboard/superadmin-role-switcher'
import { PostComposerProvider } from '@/components/dashboard/post-composer-provider'
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

  // Preview de papel só tem efeito pra quem está na allowlist de
  // SUPERADMIN_EMAILS — nunca troca o user_role real, só decide qual nav
  // renderizar para o próprio perfil ativo (ver superadmin-role-switcher.tsx).
  const superAdmin = isSuperAdmin(user.email)
  const previewRole = superAdmin ? await getPreviewRole() : null
  const effectiveProfile = previewRole ? { ...profile, user_role: previewRole } : profile
  const t = await getTranslations('DashboardNav')

  return (
    <PostComposerProvider
      profileId={effectiveProfile.id}
      userId={user.id}
      displayName={effectiveProfile.display_name}
      avatarUrl={effectiveProfile.avatar_url}
      originalLocale={effectiveProfile.locale}
    >
      <div className="flex h-screen overflow-hidden bg-background">
        <DashboardSidebar profile={effectiveProfile} accessibleProfiles={accessibleProfiles} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="h-14 md:h-12 border-b grid grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 shrink-0">
            <HeaderSearch />
            <MobileHeader />
            <div className="flex items-center gap-1 justify-self-end">
              <Link
                href="/dashboard/buscar"
                aria-label={t('search')}
                title={t('search')}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
              >
                <Search className="h-4 w-4" />
              </Link>
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

        <MobileBottomNav profile={effectiveProfile} />
        <CreateContentFab role={effectiveProfile.user_role} />
        {superAdmin && <SuperadminRoleSwitcher effectiveRole={effectiveProfile.user_role} isPreviewing={previewRole !== null} />}
      </div>
    </PostComposerProvider>
  )
}
