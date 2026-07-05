import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { HighlightForm } from '@/components/highlights/highlight-form'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ExternalLink, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

export default async function EditarProjetoPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getActiveProfile()
  if (!profile) notFound()
  const { data: highlight } = await supabase.from('highlights').select('*').eq('id', id).eq('profile_id', profile.id).single()
  if (!highlight) notFound()

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .eq('highlight_id', id)
    .order('order_index')

  const { data: budgetCategories } = await supabase
    .from('project_budget_categories')
    .select('*')
    .eq('highlight_id', id)
    .order('order_index')

  const publicSlug = highlight.slug ?? highlight.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Editar projeto</h1>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/dashboard/projetos/${id}/equipe`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Equipe</span>
          </Link>
          <Link
            href={`/${profile.username}/projetos/${publicSlug}`}
            target="_blank"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Ver publicamente</span>
          </Link>
        </div>
      </div>
      <HighlightForm highlight={{ ...highlight, milestones: milestones ?? [], budgetCategories: budgetCategories ?? [] }} profileId={profile.id} backPath="/dashboard/projetos" />
    </div>
  )
}
