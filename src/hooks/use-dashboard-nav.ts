'use client'

import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/types/database'
import {
  Home,
  FileText,
  FolderOpen,
  Users,
  Heart,
  Wallet,
  Sparkles,
  Settings,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react'

// Fonte única de nav pros dois papéis — o papel do perfil ATIVO (não do
// usuário logado) decide qual conjunto aparece. Extraído de sidebar.tsx
// pra poder ser usado também fora de /dashboard (AccountMenuDrawer, que
// agora é acionado a partir de /[username]).
export function useNav(role: UserRole) {
  const t = useTranslations('DashboardNav')
  const feedItem = { href: '/dashboard', label: t('feed'), icon: Home, exact: true }

  if (role === 'partner') {
    return [
      feedItem,
      { href: '/dashboard/mensagens', label: t('messages'), icon: MessageSquare, exact: false },
      { href: '/dashboard/meus-projetos', label: t('myProjects'), icon: FolderOpen, exact: false },
      { href: '/dashboard/financeiro-parceiro', label: t('myGiving'), icon: Wallet, exact: false },
      { href: '/dashboard/configuracoes', label: t('settings'), icon: Settings, exact: false },
    ]
  }

  return [
    feedItem,
    { href: '/dashboard/painel', label: t('overview'), icon: LayoutDashboard, exact: false },
    { href: '/dashboard/publicacoes', label: t('posts'), icon: FileText, exact: false },
    { href: '/dashboard/projetos', label: t('projects'), icon: FolderOpen, exact: false },
    { href: '/dashboard/parceiros', label: t('partners'), icon: Users, exact: false },
    { href: '/dashboard/oracoes', label: t('prayers'), icon: Heart, exact: false },
    { href: '/dashboard/mensagens', label: t('messages'), icon: MessageSquare, exact: false },
    { href: '/dashboard/financeiro', label: t('finance'), icon: Wallet, exact: false },
    { href: '/dashboard/ia', label: t('aiCopilot'), icon: Sparkles, exact: false },
    { href: '/dashboard/configuracoes', label: t('settings'), icon: Settings, exact: false },
  ]
}

export function useBottomNavItems(role: UserRole) {
  const t = useTranslations('DashboardNav')
  if (role === 'partner') {
    return [
      { href: '/dashboard', label: t('home'), icon: Home, exact: true },
      { href: '/dashboard/mensagens', label: t('messages'), icon: MessageSquare, exact: false },
      { href: '/dashboard/meus-projetos', label: t('myProjects'), icon: FolderOpen, exact: false },
      { href: '/dashboard/financeiro-parceiro', label: t('myGiving'), icon: Wallet, exact: false },
    ]
  }
  return [
    { href: '/dashboard', label: t('home'), icon: Home, exact: true },
    { href: '/dashboard/projetos', label: t('projects'), icon: FolderOpen, exact: false },
    { href: '/dashboard/parceiros', label: t('partners'), icon: Users, exact: false },
    { href: '/dashboard/publicacoes', label: t('postsShort'), icon: FileText, exact: false },
  ]
}

export function useSignOut() {
  return async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Reload completo (não router.push) para evitar corrida entre o clear de
    // cookies do signOut e a checagem de sessão server-side de "/" — com
    // navegação client-side, "/" às vezes ainda via cookie stale e redirecionava
    // para /dashboard, que o middleware então barrava de volta para /login.
    window.location.href = '/'
  }
}
