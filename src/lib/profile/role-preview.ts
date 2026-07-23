import { cookies } from 'next/headers'
import { UserRole } from '@/types/database'

// Pré-visualização de papel só para superadmin (ver isSuperAdmin) — nunca
// troca o user_role real de ninguém, só decide qual nav renderizar para o
// PRÓPRIO perfil ativo do superadmin. Ver dashboard/layout.tsx.
export const PREVIEW_ROLE_COOKIE = 'preview_role'

export async function getPreviewRole(): Promise<UserRole | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(PREVIEW_ROLE_COOKIE)?.value
  return value === 'partner' || value === 'missionary' ? value : null
}
