import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { CategoryTree } from '@/components/financial/category-tree'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: categories } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('name')

  return <CategoryTree profileId={profile!.id} categories={categories ?? []} />
}
