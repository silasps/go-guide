'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { suggestCategoryId } from '@/lib/financial/suggest-category'
import { compressImage } from '@/lib/media/compress'
import { cn, formatCurrency } from '@/lib/utils'
import { FinancialAccount, TransactionCategory, TransactionType, Partner, Transaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { CategoryForm } from './category-form'
import { toast } from 'sonner'
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, X, Copy, Trash2, Loader2, Plus, Upload,
  Landmark, Tag, CalendarDays, CreditCard, CircleCheck, UserRound, Target, Paperclip,
} from 'lucide-react'

interface HighlightOption { id: string; title: string; budgetCategories: { id: string; label: string }[] }

// Só os 3 campos que `suggestCategoryId` precisa do histórico — deixa
// aceitar `Transaction[]`/`TransactionWithCategory[]` de qualquer chamador
// sem precisar remodelar nada na origem.
interface HistoryTransaction { description: string; category_id: string | null; date: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction
  accounts: FinancialAccount[]
  categories?: TransactionCategory[]
  partners?: Partner[]
  highlights?: HighlightOption[]
  defaultHighlightId?: string
  defaultType?: TransactionType
  trigger?: React.ReactNode
  // Histórico pra sugestão automática de categoria (ver
  // `suggestCategoryId`) — opcional, só desliga a sugestão pra quem
  // ainda não tem esse dado à mão, não quebra nada.
  transactions?: HistoryTransaction[]
}

interface FormValues {
  type: TransactionType
  amount: string
  description: string
  accountId: string
  categoryId: string
  partnerId: string
  manualPartnerName: string
  highlightId: string
  budgetCategoryId: string
  date: string
  isPaid: boolean
  faturaDate: string
  proofUrl: string
}

// Sessão = um "ciclo" do formulário aberto. `key` remonta o corpo (campos
// limpos) sem fechar o painel — usado pelo "Salvar e novo". `carry` é o
// que sobrevive pro próximo lançamento; `forceCreate` transforma uma
// edição em cópia (botão Duplicar).
interface Session {
  key: number
  carry: Partial<FormValues> | null
  forceCreate: boolean
}
const INITIAL_SESSION: Session = { key: 0, carry: null, forceCreate: false }

const TYPE_OPTIONS: { value: TransactionType; label: string; icon: typeof ArrowDownLeft; activeText: string }[] = [
  { value: 'income', label: 'Receita', icon: ArrowDownLeft, activeText: 'text-emerald-700' },
  { value: 'expense', label: 'Despesa', icon: ArrowUpRight, activeText: 'text-red-600' },
  { value: 'transfer', label: 'Transf.', icon: ArrowLeftRight, activeText: 'text-sky-700' },
]
const TYPE_LABEL: Record<TransactionType, string> = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }

// Cor do lançamento inteiro segue o tipo: vermelho pra despesa, verde pra
// receita (pedido do usuário). Transferência fica neutra/azul.
const ACCENT: Record<TransactionType, { text: string; button: string }> = {
  income: { text: 'text-emerald-700', button: 'bg-success text-success-foreground hover:bg-success/90' },
  expense: { text: 'text-red-600', button: 'bg-destructive text-white hover:bg-destructive/90' },
  transfer: { text: 'text-sky-700', button: 'bg-primary text-primary-foreground hover:bg-primary/90' },
}

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

// Data de hoje no fuso local — `toISOString()` (UTC) mostra o dia seguinte
// depois das 21h em Brasília.
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Compra até o dia de fechamento entra na fatura do mês corrente; depois disso, na do mês seguinte.
function defaultFaturaDate(purchaseDate: string, closingDay: number | null) {
  const d = new Date(`${purchaseDate}T00:00:00`)
  const offset = d.getDate() >= (closingDay ?? 1) ? 1 : 0
  const fd = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  return `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-01`
}

function valuesFromTransaction(t: Transaction): FormValues {
  return {
    type: t.type,
    amount: toMasked(String(Math.round(t.amount * 100))),
    description: t.description ?? '',
    accountId: t.account_id,
    categoryId: t.category_id ?? '',
    partnerId: t.partner_id ?? '',
    manualPartnerName: t.manual_partner_name ?? '',
    highlightId: t.highlight_id ?? '',
    budgetCategoryId: t.budget_category_id ?? '',
    date: t.date,
    isPaid: t.is_paid,
    faturaDate: t.fatura_date ?? '',
    proofUrl: t.proof_url ?? '',
  }
}

function blankValues(type: TransactionType, accountId: string, highlightId: string): FormValues {
  return {
    type,
    amount: '',
    description: '',
    accountId,
    categoryId: '',
    partnerId: '',
    manualPartnerName: '',
    highlightId,
    budgetCategoryId: '',
    date: todayLocal(),
    isPaid: true,
    faturaDate: '',
    proofUrl: '',
  }
}

export function TransactionForm({ open, onOpenChange, transaction, accounts, categories = [], partners = [], highlights = [], defaultHighlightId, defaultType, trigger, transactions = [] }: Props) {
  const [session, setSession] = useState<Session>(INITIAL_SESSION)
  const amountRef = useRef<HTMLInputElement>(null)

  // Fechar o painel zera a sessão — a próxima abertura começa do zero.
  function handleOpenChange(next: boolean) {
    if (!next) setSession(INITIAL_SESSION)
    onOpenChange(next)
  }

  const editing = !session.forceCreate && Boolean(transaction)
  const blank = blankValues(defaultType ?? 'expense', accounts[0]?.id ?? '', defaultHighlightId ?? '')
  const initial: FormValues = session.carry
    ? { ...blank, ...session.carry }
    : transaction
      ? valuesFromTransaction(transaction)
      : blank

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent
        showCloseButton={false}
        // Lançamento novo abre com o cursor já no valor (edição mantém o foco padrão).
        initialFocus={editing ? undefined : amountRef}
        className={cn(
          // Celular: folha que sobe de baixo, ocupando quase a tela toda.
          'fixed inset-x-0 bottom-0 top-auto left-0 h-[92dvh] max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none bg-background p-0 ring-0 flex flex-col',
          // Desktop: painel centralizado e largo, com duas colunas no corpo.
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[88dvh] sm:w-[min(64rem,calc(100%-3rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl'
        )}
      >
        <TransactionFormBody
          key={session.key}
          amountRef={amountRef}
          initial={initial}
          editing={editing}
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          partners={partners}
          highlights={highlights}
          transactions={transactions}
          onClose={() => handleOpenChange(false)}
          onAnother={(carry) => setSession((s) => ({ key: s.key + 1, carry, forceCreate: false }))}
          onDuplicate={() => setSession((s) => ({ key: s.key + 1, carry: null, forceCreate: true }))}
        />
      </DialogContent>
    </Dialog>
  )
}

interface BodyProps {
  amountRef: React.RefObject<HTMLInputElement | null>
  initial: FormValues
  editing: boolean
  transaction?: Transaction
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
  partners: Partner[]
  highlights: HighlightOption[]
  transactions: HistoryTransaction[]
  onClose: () => void
  onAnother: (carry: Partial<FormValues>) => void
  onDuplicate: () => void
}

function TransactionFormBody({ amountRef, initial, editing, transaction, accounts, categories, partners, highlights, transactions, onClose, onAnother, onDuplicate }: BodyProps) {
  const router = useRouter()
  const { pendingValue, run } = usePendingAction<'close' | 'another' | 'delete'>()
  const [v, setV] = useState<FormValues>(initial)
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV((prev) => ({ ...prev, [key]: value }))

  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState(initial.proofUrl)
  const [categoryTouched, setCategoryTouched] = useState(editing || Boolean(initial.categoryId))
  const [categoryAutoFilled, setCategoryAutoFilled] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)

  const topCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const selectedHighlight = highlights.find((h) => h.id === v.highlightId)
  const selectedAccount = accounts.find((a) => a.id === v.accountId)
  const profileId = selectedAccount?.profile_id
  const isCreditAccount = selectedAccount?.account_type === 'credit'
  const accent = ACCENT[v.type]
  const currencyLabel = !selectedAccount || selectedAccount.currency_code === 'BRL' ? 'R$' : selectedAccount.currency_code

  const faturaOptions = Array.from({ length: 6 }, (_, i) => {
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + i - 1)
    const value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`
    const label = base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) }
  })

  // Sugestão automática de categoria a partir da descrição — histórico do
  // próprio usuário primeiro, dicionário de sinônimos como reforço. Só roda
  // enquanto a pessoa não mexer no seletor de categoria com a própria mão.
  useEffect(() => {
    if (categoryTouched) return
    const timer = setTimeout(() => {
      const suggested = suggestCategoryId(v.description, transactions, topCategories)
      set('categoryId', suggested ?? '')
      setCategoryAutoFilled(Boolean(suggested))
    }, 300)
    return () => clearTimeout(timer)
  }, [v.description, categoryTouched, transactions, topCategories])

  function changeAccount(accountId: string) {
    const acc = accounts.find((a) => a.id === accountId)
    setV((prev) => ({ ...prev, accountId, faturaDate: defaultFaturaDate(prev.date, acc?.closing_day ?? null) }))
  }

  function changeDate(date: string) {
    setV((prev) => ({ ...prev, date, faturaDate: defaultFaturaDate(date, selectedAccount?.closing_day ?? null) }))
  }

  async function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setProofFile(compressed)
    setProofPreview(URL.createObjectURL(compressed))
  }

  function handleProofRemove() {
    setProofFile(null)
    setProofPreview('')
    set('proofUrl', '')
  }

  function submit(kind: 'close' | 'another') {
    const parsedAmount = parseFloat(fromMasked(v.amount))
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }
    if (!v.description.trim()) { toast.error('Descrição obrigatória.'); return }
    const account = accounts.find((a) => a.id === v.accountId)
    if (!account) { toast.error('Selecione uma conta.'); return }

    run(kind, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let proof_url: string | null = v.proofUrl || null
      if (proofFile && user) {
        const path = `${user.id}/transactions/${crypto.randomUUID()}.webp`
        const { error: uploadError } = await supabase.storage.from('media').upload(path, proofFile)
        if (!uploadError) proof_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
        else toast.error('Erro ao enviar comprovante — lançamento será salvo sem ele.')
      }

      const payload = {
        account_id: v.accountId,
        profile_id: account.profile_id,
        type: v.type,
        amount: parsedAmount,
        currency: account.currency_code,
        description: v.description.trim(),
        category_id: v.categoryId || null,
        partner_id: v.partnerId || null,
        // Reforça a exclusão mútua no próprio payload — nunca manda os dois preenchidos.
        manual_partner_name: v.partnerId ? null : (v.manualPartnerName.trim() || null),
        highlight_id: v.highlightId || null,
        budget_category_id: v.highlightId ? (v.budgetCategoryId || null) : null,
        date: v.date,
        is_credit_purchase: account.account_type === 'credit',
        fatura_date: account.account_type === 'credit' ? (v.faturaDate || defaultFaturaDate(v.date, account.closing_day ?? null)) : null,
        is_paid: v.type === 'transfer' ? true : v.isPaid,
        proof_url,
      }

      const { error } = editing && transaction
        ? await supabase.from('transactions').update(payload).eq('id', transaction.id)
        : await supabase.from('transactions').insert({ ...payload, created_by_user_id: user!.id })

      if (error) { toast.error('Erro ao salvar lançamento.'); return }
      toast.success(editing ? 'Lançamento atualizado.' : 'Lançamento criado.')
      router.refresh()
      if (kind === 'another') onAnother({ type: v.type, accountId: v.accountId, date: v.date })
      else onClose()
    })
  }

  function handleDelete() {
    if (!transaction) return
    if (!confirm('Excluir este lançamento? O saldo da conta será ajustado.')) return
    run('delete', async () => {
      const supabase = createClient()
      const { error } = await supabase.from('transactions').delete().eq('id', transaction.id)
      if (error) { toast.error('Erro ao excluir lançamento.'); return }
      toast.success('Lançamento excluído.')
      router.refresh()
      onClose()
    })
  }

  return (
    <>
      {/* Cabeçalho fixo — título, tipo colorido e seletor Receita/Despesa/Transf. */}
      <header className="shrink-0 border-b bg-background px-4 pb-4 pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto flex max-w-none items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <DialogTitle className="text-base font-semibold sm:text-lg">
              {editing ? 'Editar lançamento' : 'Novo lançamento'}
            </DialogTitle>
            <p className={cn('mt-0.5 text-[11px] font-semibold uppercase tracking-wider', accent.text)}>
              ● {editing ? `${TYPE_LABEL[v.type]} registrada` : `Nova ${TYPE_LABEL[v.type].toLowerCase()}`}
            </p>
          </div>
          {editing ? (
            <button
              type="button"
              onClick={onDuplicate}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Copy className="size-4" /> Duplicar
            </button>
          ) : (
            <span className="size-9 shrink-0" aria-hidden />
          )}
        </div>

        <div role="radiogroup" aria-label="Tipo de lançamento" className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
          {TYPE_OPTIONS.map((opt) => {
            const selected = v.type === opt.value
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set('type', opt.value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                  selected ? cn('bg-background shadow-sm', opt.activeText) : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-3.5" /> {opt.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Corpo rolável. Celular: uma coluna. Desktop: duas colunas — valor e
          contexto à esquerda, detalhes à direita (o card de detalhes ocupa as
          duas linhas da grade). */}
      <form
        id="transaction-form"
        onSubmit={(e) => { e.preventDefault(); submit('close') }}
        className="min-h-0 flex-1 overflow-y-auto bg-muted/30"
      >
        <div className="space-y-4 p-4 sm:grid sm:grid-cols-2 sm:items-start sm:gap-5 sm:space-y-0 sm:p-6">
          {/* Valor e descrição */}
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <p className="text-xs text-muted-foreground">Valor do lançamento</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-medium text-muted-foreground">{currencyLabel}</span>
              <input
                ref={amountRef}
                data-keep-font
                inputMode="numeric"
                value={v.amount}
                onChange={(e) => set('amount', toMasked(e.target.value))}
                placeholder="0,00"
                required
                className={cn('min-w-0 flex-1 bg-transparent text-4xl font-semibold outline-none placeholder:text-muted-foreground/40 sm:text-5xl', accent.text)}
              />
            </div>
            <div className="mt-5 border-t pt-4">
              <label className="text-xs text-muted-foreground" htmlFor="tx-description">Descrição</label>
              <input
                id="tx-description"
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Ex: Oferta recebida, supermercado..."
                required
                className="mt-1 w-full bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </section>

          {/* Detalhes — ocupa as duas linhas no desktop */}
          <section className="sm:row-span-2">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</h3>
            <div className="divide-y rounded-2xl border bg-card">
              <Row icon={Landmark} label="Conta">
                <select
                  value={v.accountId}
                  onChange={(e) => changeAccount(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>)}
                </select>
                {selectedAccount && (
                  <p className="text-xs text-muted-foreground">Saldo {formatCurrency(selectedAccount.balance, selectedAccount.currency_code)}</p>
                )}
              </Row>

              <Row icon={Tag} label="Categoria">
                <div className="flex gap-1.5">
                  <select
                    value={v.categoryId}
                    onChange={(e) => { set('categoryId', e.target.value); setCategoryTouched(true); setCategoryAutoFilled(false) }}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                  >
                    <option value="">Sem categoria</option>
                    {topCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCreatingCategory(true)}
                    aria-label="Nova categoria"
                    title="Nova categoria"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {categoryAutoFilled && <p className="text-xs text-muted-foreground">Sugerido automaticamente — clique pra trocar.</p>}
              </Row>

              <Row icon={CalendarDays} label="Data">
                <input
                  type="date"
                  value={v.date}
                  onChange={(e) => changeDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                />
              </Row>

              {isCreditAccount && (
                <Row icon={CreditCard} label="Fatura">
                  <select
                    value={v.faturaDate || defaultFaturaDate(v.date, selectedAccount?.closing_day ?? null)}
                    onChange={(e) => set('faturaDate', e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                  >
                    {faturaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Row>
              )}

              {v.type !== 'transfer' && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CircleCheck className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{v.type === 'income' ? 'Já recebi esse valor' : 'Já paguei essa despesa'}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.isPaid
                        ? (v.type === 'income' ? 'Somado imediatamente ao saldo da conta' : 'Deduzido imediatamente do saldo da conta')
                        : 'Fica como previsto até você confirmar'}
                    </p>
                  </div>
                  <Switch checked={v.isPaid} onCheckedChange={(checked: boolean) => set('isPaid', checked)} />
                </div>
              )}
            </div>
          </section>

          {/* Contexto e organização */}
          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contexto & organização</h3>
            <div className="divide-y rounded-2xl border bg-card">
              <Row icon={UserRound} label="Parceiro (opcional)">
                {partners.length > 0 && (
                  <select
                    value={v.partnerId}
                    onChange={(e) => setV((prev) => ({ ...prev, partnerId: e.target.value, manualPartnerName: e.target.value ? '' : prev.manualPartnerName }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                  >
                    <option value="">Nenhum</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <input
                  value={v.manualPartnerName}
                  onChange={(e) => setV((prev) => ({ ...prev, manualPartnerName: e.target.value, partnerId: e.target.value ? '' : prev.partnerId }))}
                  placeholder={partners.length > 0 ? 'Ou digite um nome (se não for cadastrado)' : 'Nome de quem mandou (opcional)'}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                />
              </Row>

              {highlights.length > 0 && (
                <Row icon={Target} label="Projeto (opcional)">
                  <select
                    value={v.highlightId}
                    onChange={(e) => setV((prev) => ({ ...prev, highlightId: e.target.value, budgetCategoryId: '' }))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                  >
                    <option value="">Nenhum</option>
                    {highlights.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
                  </select>
                  {selectedHighlight && selectedHighlight.budgetCategories.length > 0 && (
                    <select
                      value={v.budgetCategoryId}
                      onChange={(e) => set('budgetCategoryId', e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                    >
                      <option value="">Projeto geral</option>
                      {selectedHighlight.budgetCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  )}
                </Row>
              )}

              <Row icon={Paperclip} label="Comprovante (opcional)">
                {proofPreview ? (
                  <div className="flex items-center gap-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border">
                      <Image src={proofPreview} alt="Comprovante" fill sizes="64px" className="object-cover" unoptimized={proofPreview.startsWith('blob:')} />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
                        Trocar
                        <input type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
                      </label>
                      <button type="button" onClick={handleProofRemove} className="text-sm text-muted-foreground hover:text-destructive">
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
                    <Upload className="size-4" /> Anexar comprovante
                    <input type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
                  </label>
                )}
              </Row>
            </div>
          </section>
        </div>
      </form>

      {/* Rodapé fixo — ações sempre à mão, sem precisar rolar até o fim. */}
      <footer className="shrink-0 border-t bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 sm:px-6 sm:pb-5">
        <div className="flex gap-2 sm:justify-end">
          {editing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={Boolean(pendingValue)}
              aria-label="Excluir lançamento"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
            >
              {pendingValue === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          )}
          {!editing && (
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl sm:flex-none sm:px-6"
              disabled={Boolean(pendingValue)}
              onClick={() => submit('another')}
            >
              {pendingValue === 'another' && <Loader2 className="size-4 animate-spin" />}
              Salvar e lançar outro
            </Button>
          )}
          <Button
            type="submit"
            form="transaction-form"
            className={cn('h-12 flex-[1.4] rounded-xl sm:flex-none sm:min-w-44 sm:px-8', accent.button)}
            disabled={Boolean(pendingValue)}
          >
            {pendingValue === 'close' && <Loader2 className="size-4 animate-spin" />}
            {editing ? 'Salvar alterações' : 'Lançar'}
          </Button>
        </div>
      </footer>

      {/* Modal aninhado — mesmo padrão de antes: categoria recém-criada já entra selecionada. */}
      {profileId && (
        <CategoryForm
          open={creatingCategory}
          onOpenChange={setCreatingCategory}
          profileId={profileId}
          onCreated={(cat) => { set('categoryId', cat.id); setCategoryTouched(true); setCategoryAutoFilled(false) }}
        />
      )}
    </>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof Plus; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  )
}
