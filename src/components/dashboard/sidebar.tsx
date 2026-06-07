'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import { Profile } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Users,
  Heart,
  Wallet,
  Sparkles,
  Settings,
  MessageSquare,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/publicacoes', label: 'Publicações', icon: FileText },
  { href: '/dashboard/projetos', label: 'Projetos', icon: FolderOpen },
  { href: '/dashboard/parceiros', label: 'Parceiros', icon: Users },
  { href: '/dashboard/oracoes', label: 'Orações', icon: Heart },
  { href: '/dashboard/mensagens', label: 'Mensagens', icon: MessageSquare },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/dashboard/ia', label: 'IA Copiloto', icon: Sparkles },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
]

const bottomNavItems = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/projetos', label: 'Projetos', icon: FolderOpen },
  { href: '/dashboard/parceiros', label: 'Parceiros', icon: Users },
  { href: '/dashboard/publicacoes', label: 'Posts', icon: FileText },
]

function useSignOut() {
  const router = useRouter()
  return async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
}

export function DashboardSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const handleSignOut = useSignOut()

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-card shrink-0">
      <div className="flex items-center gap-2 px-4 py-5 border-b">
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: profile.accent_color }}>
          <span className="text-white text-xs font-bold">M</span>
        </div>
        <span className="font-semibold text-sm">go→guide</span>
      </div>

      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url ?? ''} alt={profile.display_name} />
            <AvatarFallback className="text-xs">{getInitials(profile.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile.display_name}</p>
            <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs shrink-0">
            {profile.plan}
          </Badge>
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
          target="_blank"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Ver meu perfil
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}

export function MobileHeader({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-2 md:hidden">
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: profile.accent_color }}
      >
        <span className="text-white text-xs font-bold">M</span>
      </div>
      <span className="font-semibold text-sm">go→guide</span>
    </div>
  )
}

export function MobileBottomNav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const handleSignOut = useSignOut()

  return (
    <>
      {/* Bottom tab bar */}
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
        <button
          onClick={() => setMenuOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Full menu overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          {/* Drawer from bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Profile info */}
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
                onClick={() => setMenuOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* All nav items */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {nav.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
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

            {/* Footer actions */}
            <div className="px-3 py-3 border-t space-y-1 pb-safe">
              <Link
                href={`/${profile.username}`}
                target="_blank"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-5 w-5" />
                Ver meu perfil público
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
