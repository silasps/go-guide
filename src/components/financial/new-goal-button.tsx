'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GoalForm } from './goal-form'
import { Plus } from 'lucide-react'

interface Props {
  profileId: string
  currencies: string[]
}

export function NewGoalButton({ profileId, currencies }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Nova meta
      </Button>
      <GoalForm open={open} onOpenChange={setOpen} profileId={profileId} currencies={currencies} />
    </>
  )
}
