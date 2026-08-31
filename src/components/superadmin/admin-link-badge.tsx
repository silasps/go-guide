import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/superadmin'

// Renderizado no layout raiz — aparece em QUALQUER página (pública,
// dashboard, checkout...), não só dentro de /superadmin, a pedido do
// usuário. Só existe pra quem está na allowlist SUPERADMIN_EMAILS.
export async function AdminLinkBadge() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isSuperAdmin(user?.email)) return null

  const t = await getTranslations('Superadmin')

  return (
    <Link
      href="/superadmin"
      className="fixed bottom-20 right-4 md:bottom-4 z-50 flex items-center gap-1.5 rounded-full border bg-card shadow-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
    >
      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
      <span className="hidden sm:inline">{t('adminArea')}</span>
    </Link>
  )
}
