import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { SuperadminNav } from '@/components/superadmin/superadmin-nav'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isSuperAdmin(user?.email)) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background">
      <SuperadminNav />
      {children}
    </div>
  )
}
