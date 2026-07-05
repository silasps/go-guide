import { createClient } from '@/lib/supabase/server'
import { CategoryTree } from '@/components/financial/category-tree'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()

  const { data: categories } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('name')

  return <CategoryTree profileId={profile!.id} categories={categories ?? []} />
}
