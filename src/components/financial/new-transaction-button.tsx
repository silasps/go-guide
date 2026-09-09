'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TransactionForm } from './transaction-form'
import { FinancialAccount, TransactionCategory, Partner, Transaction } from '@/types/database'
import { Plus } from 'lucide-react'

interface Props {
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
  partners: Partner[]
  highlights: { id: string; title: string; budgetCategories: { id: string; label: string }[] }[]
  defaultHighlightId?: string
  // Histórico pra sugestão automática de categoria (ver `TransactionForm`)
  transactions?: Pick<Transaction, 'description' | 'category_id' | 'date'>[]
}

export function NewTransactionButton({ accounts, categories, partners, highlights, defaultHighlightId, transactions }: Props) {
  const [open, setOpen] = useState(false)

  if (accounts.length === 0) {
    return <Button disabled title="Crie uma conta primeiro" className="gap-2"><Plus className="h-4 w-4" /> Novo lançamento</Button>
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      <TransactionForm
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        categories={categories}
        partners={partners}
        highlights={highlights}
        defaultHighlightId={defaultHighlightId}
        transactions={transactions}
      />
    </>
  )
}
