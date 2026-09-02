'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RecurringTransactionForm } from './recurring-transaction-form'
import { FinancialAccount, TransactionCategory } from '@/types/database'
import { Plus } from 'lucide-react'

interface Props {
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
}

export function NewRecurringTransactionButton({ accounts, categories }: Props) {
  const [open, setOpen] = useState(false)

  if (accounts.length === 0) {
    return <Button disabled title="Crie uma conta primeiro" className="gap-2"><Plus className="h-4 w-4" /> Nova recorrência</Button>
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Nova recorrência
      </Button>
      <RecurringTransactionForm open={open} onOpenChange={setOpen} accounts={accounts} categories={categories} />
    </>
  )
}
