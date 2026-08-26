'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Tab } from './profile-content-tabs'

const ProfileTabContext = createContext<{ tab: Tab; setTab: (t: Tab) => void } | null>(null)

/** Estado compartilhado da aba ativa (Posts/Projetos/História) entre o
 *  ProfileHeader (estatísticas clicáveis) e o ProfileContentTabs (seletor
 *  inline) — clicar num número do header troca a aba sem navegar/recarregar. */
export function ProfileTabProvider({ initialTab, children }: { initialTab?: Tab; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'posts')
  return <ProfileTabContext.Provider value={{ tab, setTab }}>{children}</ProfileTabContext.Provider>
}

export function useProfileTab() {
  const ctx = useContext(ProfileTabContext)
  if (!ctx) throw new Error('useProfileTab precisa estar dentro de ProfileTabProvider')
  return ctx
}
