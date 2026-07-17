'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Profile } from '@/types/database'
import { useNav, useSignOut } from '@/hooks/use-dashboard-nav'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Menu, UserCircle, LogOut, X } from 'lucide-react'

export type DrawerProfile = Pick<
  Profile,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'accent_color' | 'plan' | 'user_role'
>

interface Props {
  profile: DrawerProfile
}

// Gaveta de navegação completa — extraída de MobileBottomNav. Antes era
// acionada pelo botão "Menu" do rodapé; agora é self-contained (gerencia o
// próprio open/trigger, igual EditProfileDialog) porque também é montada a
// partir de /[username] (fora da árvore /dashboard), onde o ícone ≡ mora
// hoje, no mesmo lugar do menu sanduíche do Instagram.
export function AccountMenuDrawer({ profile }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('DashboardNav')
  const pathname = usePathname()
  const handleSignOut = useSignOut()
  const nav = useNav(profile.user_role)
  const onOwnProfile = pathname.startsWith(`/${profile.username}`)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('menu')}
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex items-center gap-3 px-5 py-3 border-b">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
                <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{profile.display_name}</p>
                <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">{profile.plan}</Badge>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {nav.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </div>

            <div className="px-3 py-3 border-t space-y-1 pb-safe">
              {!onOwnProfile && (
                <Link
                  href={`/${profile.username}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <UserCircle className="h-5 w-5" />
                  {t('viewPublicProfile')}
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="h-5 w-5" />
                {t('signOut')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
