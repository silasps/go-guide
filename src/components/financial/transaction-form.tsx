'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { suggestCategoryId } from '@/lib/financial/suggest-category'
import { FinancialAccount, TransactionCategory, TransactionType, Partner, Transaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CategoryForm } from './category-form'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

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

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

// Compra até o dia de fechamento entra na fatura do mês corrente; depois disso, na do mês seguinte.
function defaultFaturaDate(purchaseDate: string, closingDay: number | null) {
  const d = new Date(`${purchaseDate}T00:00:00`)
  const offset = d.getDate() >= (closingDay ?? 1) ? 1 : 0
  const fd = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  return `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-01`
}

export function TransactionForm({ open, onOpenChange, transaction, accounts, categories = [], partners = [], highlights = [], defaultHighlightId, defaultType, trigger, transactions = [] }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType ?? 'income')
  const [amount, setAmount] = useState(transaction ? toMasked(String(Math.round(transaction.amount * 100))) : '')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [accountId, setAccountId] = useState(transaction?.account_id ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '')
  const [partnerId, setPartnerId] = useState(transaction?.partner_id ?? '')
  // Pra quando quem mandou a oferta não é (e talvez nunca vá ser) um
  // parceiro cadastrado — só um nome solto, pra lembrete futuro de quem
  // foi. Mutuamente exclusivo com `partnerId` na prática (ver onChange dos
  // dois campos abaixo e o payload em `handleSave`), mesma filosofia de
  // `pledges.reporter_name` (texto livre, sem exigir cadastro formal).
  const [manualPartnerName, setManualPartnerName] = useState(transaction?.manual_partner_name ?? '')
  const [highlightId, setHighlightId] = useState(transaction?.highlight_id ?? defaultHighlightId ?? '')
  const [budgetCategoryId, setBudgetCategoryId] = useState(transaction?.budget_category_id ?? '')
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10))
  const [isPaid, setIsPaid] = useState(transaction ? transaction.is_paid : date <= new Date().toISOString().slice(0, 10))
  // `categoryTouched` começa `true` numa edição — nunca sobrescreve a
  // categoria que a pessoa já tinha escolhido antes. Numa criação nova,
  // fica `false` até o próprio usuário mexer no seletor; até lá, a
  // sugestão automática (efeito abaixo) pode seguir atualizando
  // `categoryId` livremente conforme a descrição muda.
  const [categoryTouched, setCategoryTouched] = useState(Boolean(transaction))
  const [categoryAutoFilled, setCategoryAutoFilled] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)

  const topCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories])
  const selectedHighlight = highlights.find(h => h.id === highlightId)
  const selectedAccount = accounts.find(a => a.id === accountId)
  // Mesmo profile_id que já vai no payload do lançamento (linha abaixo,
  // `account.profile_id`) — evita ter que enfiar `profileId` como prop
  // nova em `NewTransactionButton`/`LancamentosPage` só pra isso.
  const profileId = selectedAccount?.profile_id
  const isCreditAccount = selectedAccount?.account_type === 'credit'
  const [faturaDate, setFaturaDate] = useState(transaction?.fatura_date ?? defaultFaturaDate(date, selectedAccount?.closing_day ?? null))

  const faturaOptions = Array.from({ length: 6 }, (_, i) => {
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + i - 1)
    const value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`
    const label = base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) }
  })

  // Sugestão automática de categoria a partir da descrição (pedido do
  // usuário) — histórico do próprio usuário primeiro (mais confiável),
  // dicionário de sinônimos como reforço (ver `suggestCategoryId`). Só
  // roda em lançamento novo, e só enquanto o usuário não mexer no
  // seletor de categoria com a própria mão — a sugestão nunca é
  // obrigatória, é só um palpite que a pessoa pode trocar clicando.
  useEffect(() => {
    if (categoryTouched) return
    const timer = setTimeout(() => {
      const suggested = suggestCategoryId(description, transactions, topCategories)
      setCategoryId(suggested ?? '')
      setCategoryAutoFilled(Boolean(suggested))
    }, 300)
    return () => clearTimeout(timer)
  }, [description, categoryTouched, transactions, topCategories])

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount))
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }
    if (!description.trim()) { toast.error('Descrição obrigatória.'); return }
    const account = accounts.find(a => a.id === accountId)
    if (!account) { toast.error('Selecione uma conta.'); return }

    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        account_id: accountId,
        profile_id: account.profile_id,
        type,
        amount: parsedAmount,
        currency: account.currency_code,
        description: description.trim(),
        category_id: categoryId || null,
        partner_id: partnerId || null,
        // Reforça a exclusão mútua no próprio payload (defesa a mais além
        // do onChange dos dois campos) — nunca manda os dois preenchidos.
        manual_partner_name: partnerId ? null : (manualPartnerName.trim() || null),
        highlight_id: highlightId || null,
        budget_category_id: highlightId ? (budgetCategoryId || null) : null,
        date,
        is_credit_purchase: isCreditAccount,
        fatura_date: isCreditAccount ? faturaDate : null,
        is_paid: type === 'transfer' ? true : isPaid,
      }

      const { error } = transaction
        ? await supabase.from('transactions').update(payload).eq('id', transaction.id)
        : await supabase.from('transactions').insert({ ...payload, created_by_user_id: user!.id })

      if (error) { toast.error('Erro ao salvar lançamento.'); return }
      toast.success(transaction ? 'Lançamento atualizado.' : 'Lançamento criado.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      {/* sm:max-w-md (em vez do max-w-sm de qualquer outro modal financeiro)
          — só no desktop/tablet; no celular continua igual (max-w-sm já
          cobre a tela toda ali). O botão "+" ao lado do seletor de
          Categoria (abaixo) apertou o espaço que sobrava pro texto de
          cada opção, cortando "Sem categoria" — usuário mandou print. */}
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'income', label: '💰 Entrada' },
              { value: 'expense', label: '💸 Saída' },
              { value: 'transfer', label: '🔁 Transf.' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`py-2 px-2 rounded-lg border text-xs transition-colors ${type === value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Conta</Label>
              <select value={accountId} onChange={(e) => { setAccountId(e.target.value); const acc = accounts.find(a => a.id === e.target.value); setFaturaDate(defaultFaturaDate(date, acc?.closing_day ?? null)) }} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value))} placeholder="0,00" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} placeholder="Ex: Oferta recebida" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex gap-1.5">
                <select
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setCategoryTouched(true); setCategoryAutoFilled(false) }}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  <option value="">Sem categoria</option>
                  {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setCreatingCategory(true)}
                  aria-label="Nova categoria"
                  title="Nova categoria"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {categoryAutoFilled && <p className="text-xs text-muted-foreground">Sugerido automaticamente — clique pra trocar.</p>}
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDate(e.target.value); setFaturaDate(defaultFaturaDate(e.target.value, selectedAccount?.closing_day ?? null)) }} />
            </div>
          </div>

          {type !== 'transfer' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="h-4 w-4 rounded border-input" />
              {type === 'income' ? 'Já recebi esse valor' : 'Já paguei essa despesa'}
            </label>
          )}

          {isCreditAccount && (
            <div className="space-y-2">
              <Label>Fatura</Label>
              <select value={faturaDate} onChange={(e) => setFaturaDate(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                {faturaOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Parceiro (opcional)</Label>
            {partners.length > 0 && (
              <select
                value={partnerId}
                onChange={(e) => { setPartnerId(e.target.value); if (e.target.value) setManualPartnerName('') }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Nenhum</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {/* Quem mandou a oferta pode não estar cadastrado como
                parceiro (e não precisar estar, só pra um lançamento
                avulso) — nome solto aqui, só pra lembrete futuro de quem
                foi. Escolher um parceiro acima limpa esse campo, e
                vice-versa (mutuamente exclusivo, ver payload). */}
            <Input
              value={manualPartnerName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setManualPartnerName(e.target.value); if (e.target.value) setPartnerId('') }}
              placeholder={partners.length > 0 ? 'Ou digite um nome (se não for cadastrado)' : 'Nome de quem mandou (opcional)'}
              className="h-8"
            />
          </div>

          {highlights.length > 0 && (
            <div className="space-y-2">
              <Label>Projeto (opcional)</Label>
              <select value={highlightId} onChange={(e) => { setHighlightId(e.target.value); setBudgetCategoryId('') }} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                <option value="">Nenhum</option>
                {highlights.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
              </select>
            </div>
          )}

          {selectedHighlight && selectedHighlight.budgetCategories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoria do orçamento (opcional)</Label>
              <select value={budgetCategoryId} onChange={(e) => setBudgetCategoryId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                <option value="">Projeto geral</option>
                {selectedHighlight.budgetCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transaction ? 'Salvar' : 'Lançar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Modal aninhado — mesmo padrão de `DiscardConfirmDialog` (Dialog
        irmão, não dentro do DialogContent de cima, com z-[70] pra ficar
        por cima do modal de lançamento que continua aberto atrás). A
        categoria recém-criada já entra selecionada no `<select>` acima. */}
    {profileId && (
      <CategoryForm
        open={creatingCategory}
        onOpenChange={setCreatingCategory}
        profileId={profileId}
        onCreated={(cat) => { setCategoryId(cat.id); setCategoryTouched(true); setCategoryAutoFilled(false) }}
      />
    )}
    </>
  )
}
