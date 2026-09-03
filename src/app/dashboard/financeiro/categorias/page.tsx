import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { CategoryTree } from '@/components/financial/category-tree'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const [{ data: categories }, { data: limits }] = await Promise.all([
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id).order('name'),
    supabase.from('spending_limits').select('category_id, limit_amount, currency').eq('profile_id', profile!.id),
  ])

  return <CategoryTree profileId={profile!.id} categories={categories ?? []} limits={limits ?? []} />
}
