'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn, getInitials } from '@/lib/utils'
import { Profile } from '@/types/database'
import { AccessibleProfile } from '@/lib/profile/active-profile'
import { setActiveProfile, becomeMissionary } from '@/app/dashboard/actions'
import { useNav, useBottomNavItems, useSignOut } from '@/hooks/use-dashboard-nav'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  UserCircle,
  LogOut,
  ChevronsUpDown,
  Check,
  Compass,
  Loader2,
} from 'lucide-react'

function AccountSwitcher({ profile, accessibleProfiles }: { profile: Profile; accessibleProfiles: AccessibleProfile[] }) {
  if (accessibleProfiles.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="p-1 rounded-md text-muted-foreground hover:text-foreground shrink-0">
        <ChevronsUpDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {accessibleProfiles.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => setActiveProfile(p.id)} className="gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={p.avatar_url ?? ''} alt={p.display_name} />
              <AvatarFallback className="text-[10px]">{getInitials(p.display_name)}</AvatarFallback>
            </Avatar>
            <span className="truncate flex-1">{p.display_name}</span>
            {p.id === profile.id && <Check className="h-3.5 w-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DashboardSidebar({ profile, accessibleProfiles }: { profile: Profile; accessibleProfiles: AccessibleProfile[] }) {
  const t = useTranslations('DashboardNav')
  const tBecome = useTranslations('BecomeMissionary')
  const pathname = usePathname()
  const handleSignOut = useSignOut()
  const nav = useNav(profile.user_role)
  const { isPending: becomingMissionary, run: runBecomeMissionary } = usePendingAction()

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-card shrink-0">
      <div className="flex items-center px-4 py-5 border-b">
        <Image src="/logo.png" alt="Go guide" width={110} height={52} className="h-7 w-auto dark:hidden" priority />
        <Image src="/logo-white.png" alt="Go guide" width={110} height={52} className="h-7 w-auto hidden dark:block" priority />
      </div>

      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
            <AvatarFallback className="text-xs">{getInitials(profile.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile.display_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              @{profile.username} · {profile.user_role === 'missionary' ? t('roleBadgeMissionary') : t('roleBadgePartner')}
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs shrink-0">
            {profile.plan}
          </Badge>
          <AccountSwitcher profile={profile} accessibleProfiles={accessibleProfiles} />
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t space-y-0.5">
        <Link
          href={`/${profile.username}`}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <UserCircle className="h-4 w-4" />
          {t('viewProfile')}
        </Link>
        {profile.user_role === 'partner' && (
          <button
            disabled={becomingMissionary}
            onClick={() => runBecomeMissionary(true, async () => { await becomeMissionary() })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60"
          >
            {becomingMissionary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            {tBecome('cta')}
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t('signOut')}
        </button>
      </div>
    </aside>
  )
}

export function MobileHeader() {
  return (
    <div className="flex items-center gap-2 md:hidden">
      <Image src="/icon-mark.png" alt="Go guide" width={24} height={24} className="h-6 w-6 rounded-md" priority />
      <span className="font-semibold text-sm">Go guide</span>
    </div>
  )
}

export function MobileBottomNav({ profile }: { profile: Profile }) {
  const t = useTranslations('DashboardNav')
  const pathname = usePathname()
  const bottomNavItems = useBottomNavItems(profile.user_role)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t flex items-stretch h-16">
      {bottomNavItems.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className={cn('h-5 w-5', active && 'fill-primary/10')} />
            <span>{label}</span>
          </Link>
        )
      })}
      {/* Miniatura do próprio perfil — abre /[username], onde o dono vê
          abas/edição/menu completo, igual ao Instagram (avatar sempre a
          última aba do rodapé). */}
      <Link
        href={`/${profile.username}`}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground"
      >
        <Avatar className="h-5 w-5">
          <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
          <AvatarFallback className="text-[9px]">{getInitials(profile.display_name)}</AvatarFallback>
        </Avatar>
        <span>{t('profileTab')}</span>
      </Link>
    </nav>
  )
}
