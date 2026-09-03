'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SpendingLimitForm } from './spending-limit-form'
import { TransactionCategory } from '@/types/database'
import { Plus } from 'lucide-react'

interface Props {
  profileId: string
  categories: TransactionCategory[]
  currencies: string[]
  usedCategoryIds: string[]
}

export function NewSpendingLimitButton({ profileId, categories, currencies, usedCategoryIds }: Props) {
  const [open, setOpen] = useState(false)
  const hasAvailableCategory = categories.some((c) => !c.parent_id && !usedCategoryIds.includes(c.id))

  if (!hasAvailableCategory) {
    return <Button disabled title="Todas as categorias já têm limite, ou crie uma categoria primeiro" className="gap-2"><Plus className="h-4 w-4" /> Novo limite</Button>
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Novo limite
      </Button>
      <SpendingLimitForm open={open} onOpenChange={setOpen} profileId={profileId} categories={categories} currencies={currencies} usedCategoryIds={usedCategoryIds} />
    </>
  )
}
