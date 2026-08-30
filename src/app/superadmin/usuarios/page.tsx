import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { UsersTable, type AdminUserRow } from '@/components/superadmin/users-table'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export default async function SuperadminUsersPage() {
  const service = serviceClient()

  const { data } = await service
    .from('profiles')
    .select('id, username, display_name, avatar_url, user_role, gender, privacy_mode, verification_status, account_status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const users: AdminUserRow[] = data ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <UsersTable users={users} />
    </div>
  )
}
