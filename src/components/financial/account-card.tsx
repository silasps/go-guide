'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { cn, formatCurrency } from '@/lib/utils'
import { FinancialAccount } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { DiscardConfirmDialog } from '@/components/shared/discard-confirm-dialog'
import { AccountForm } from './account-form'
import { ManageMembersDialog } from './manage-members-dialog'
import { BalanceAdjustmentDialog } from './balance-adjustment-dialog'
import { TransferDialog } from './transfer-dialog'
import { ImportStatementDialog } from './import-statement-dialog'
import { toast } from 'sonner'
import {
  Archive, ArchiveRestore, ArrowLeftRight, DollarSign, Loader2, MoreVertical,
  Pencil, ScrollText, TrendingDown, TrendingUp, Upload, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { checking: 'Conta corrente', savings: 'Poupança', credit: 'Cartão de crédito' }

interface Member { id: string; user_id: string; role: string }

interface Props {
  account: FinancialAccount
  profileId: string
  accounts: FinancialAccount[]
  members: Member[]
  currentBill?: number
}

interface Action {
  key: string
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  pending?: boolean
}

const ACTION_BUTTON_CLASS = 'flex h-[52px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-input bg-background text-[11px] font-semibold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground'

// Card de conta (estilo GranaZen, ver system.architecture.md 7.29) —
// caixa de saldo com ícone, grid de ações (3 colunas, desktop) ou menu
// "..." (mobile), arquivar com confirmação. Sem "Conta padrão" (é sobre
// lançar transação via WhatsApp; este app não tem bot — mesma decisão já
// registrada em `account-wizard.tsx`).
export function AccountCard({ account, profileId, accounts, members, currentBill = 0 }: Props) {
  const router = useRouter()
  const { isPending: archiving, run } = usePendingAction()
  const isCredit = account.account_type === 'credit'
  const bill = Math.max(0, currentBill)
  const available = account.credit_limit != null ? account.credit_limit - bill : null
  const usedPct = account.credit_limit ? Math.min((bill / account.credit_limit) * 100, 100) : 0

  const [editing, setEditing] = useState(false)
  const [managingMembers, setManagingMembers] = useState(false)
  const [adjustingBalance, setAdjustingBalance] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [importingOfx, setImportingOfx] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)

  function setArchived(next: boolean) {
    run(true, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('financial_accounts').update({ archived: next }).eq('id', account.id)
      if (error) { toast.error('Erro ao atualizar conta.'); return }
      toast.success(next ? 'Conta arquivada.' : 'Conta reativada.')
      setArchiveConfirmOpen(false)
      router.refresh()
    })
  }

  const actions: Action[] = [
    { key: 'extrato', label: 'Extrato', icon: ScrollText, href: `/dashboard/financeiro/lancamentos?account=${account.id}` },
    ...(!isCredit ? [
      { key: 'ajustar', label: 'Ajustar saldo', icon: DollarSign, onClick: () => setAdjustingBalance(true) },
      { key: 'transferir', label: 'Transferir', icon: ArrowLeftRight, onClick: () => setTransferring(true) },
      { key: 'importar', label: 'Importar OFX', icon: Upload, onClick: () => setImportingOfx(true) },
    ] as Action[] : []),
    { key: 'editar', label: 'Editar', icon: Pencil, onClick: () => setEditing(true) },
    {
      key: 'arquivar',
      label: account.archived ? 'Reativar' : 'Arquivar',
      icon: account.archived ? ArchiveRestore : Archive,
      onClick: () => account.archived ? setArchived(false) : setArchiveConfirmOpen(true),
      pending: archiving,
    },
    ...(account.is_shared ? [{ key: 'membros', label: `Membros (${members.length})`, icon: Users, onClick: () => setManagingMembers(true) }] as Action[] : []),
  ]
  const dropdownActions = actions.filter((a) => a.key !== 'extrato')

  return (
    <Card>
      <CardContent className="space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="block truncate text-base font-semibold leading-snug text-foreground md:text-[1.05rem]">{account.name}</span>
            <p className="text-xs text-muted-foreground">
              {TYPE_LABEL[account.account_type]} · {account.currency_code}{account.card_brand ? ` · ${account.card_brand}` : ''}
            </p>
            {(account.is_open_finance || account.is_shared) && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {account.is_open_finance && <Badge variant="outline">Open Finance</Badge>}
                {account.is_shared && <Badge variant="secondary">Compartilhada</Badge>}
              </div>
            )}
          </div>
          <div className="shrink-0 md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Opções" title="Opções" className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70 transition-colors">
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* "Extrato" fica de fora — já vira um link cheio logo abaixo do saldo,
                    então nenhuma ação que sobra pro menu tem `href` (todas são onClick). */}
                {dropdownActions.map((a) => (
                  <DropdownMenuItem key={a.key} disabled={a.pending} onClick={a.onClick} className="gap-2.5 px-2.5 py-2">
                    {a.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isCredit ? (
          <div className="space-y-2 rounded-lg border px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Fatura atual</p>
              <p className="mt-1 text-2xl font-semibold md:text-[1.7rem]">{formatCurrency(bill, account.currency_code)}</p>
            </div>
            {account.credit_limit != null && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usedPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Disponível: {formatCurrency(available ?? 0, account.currency_code)}</span>
                  <span>Limite: {formatCurrency(account.credit_limit, account.currency_code)}</span>
                </div>
              </>
            )}
            {(account.closing_day || account.due_day) && (
              <p className="text-xs text-muted-foreground">
                {account.closing_day && `Fecha dia ${account.closing_day}`}
                {account.closing_day && account.due_day && ' · '}
                {account.due_day && `Vence dia ${account.due_day}`}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={cn('flex size-5 shrink-0 items-center justify-center', account.balance >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {account.balance >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">Saldo atual</span>
            </div>
            <p className={cn('mt-1 truncate text-2xl font-semibold md:text-[1.7rem]', account.balance >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {formatCurrency(account.balance, account.currency_code)}
            </p>
          </div>
        )}

        <Link
          href={`/dashboard/financeiro/lancamentos?account=${account.id}`}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-input bg-muted/40 px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted md:hidden"
        >
          <ScrollText className="h-4 w-4" /> Extrato
        </Link>

        <div className="hidden grid-cols-3 gap-2 md:grid">
          {actions.map((a) => {
            const content = (
              <>
                {a.pending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <a.icon className="h-[18px] w-[18px]" />}
                <span>{a.label}</span>
              </>
            )
            return a.href ? (
              <Link key={a.key} href={a.href} className={ACTION_BUTTON_CLASS}>{content}</Link>
            ) : (
              <button key={a.key} type="button" disabled={a.pending} onClick={a.onClick} className={ACTION_BUTTON_CLASS}>{content}</button>
            )
          })}
        </div>
      </CardContent>

      {editing && <AccountForm open onOpenChange={setEditing} profileId={profileId} account={account} />}
      {managingMembers && <ManageMembersDialog open onOpenChange={setManagingMembers} accountId={account.id} members={members} />}
      {adjustingBalance && <BalanceAdjustmentDialog open onOpenChange={setAdjustingBalance} account={account} />}
      {transferring && <TransferDialog open onOpenChange={setTransferring} sourceAccount={account} accounts={accounts} />}
      {importingOfx && <ImportStatementDialog open onOpenChange={setImportingOfx} profileId={profileId} account={account} />}
      <DiscardConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
        onDiscard={() => setArchived(true)}
        title="Arquivar conta?"
        description={`"${account.name}" some da lista de contas ativas, mas o histórico de lançamentos continua intacto. Dá pra reativar quando quiser.`}
        cancelLabel="Cancelar"
        confirmLabel={archiving ? 'Arquivando…' : 'Arquivar'}
      />
    </Card>
  )
}
