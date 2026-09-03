'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, cn } from '@/lib/utils'
import { toMasked, fromMasked, reformatMasked, CURRENCIES } from '@/lib/currency-mask'
import { AccountType } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Landmark, Wallet, PiggyBank, CreditCard,
  CirclePlus, CircleMinus,
} from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
}

type AccountKind = 'automatic' | 'manual'
type BalanceSign = 'positive' | 'negative'

const TOTAL_STEPS = 6
const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra']
const TYPE_LABEL: Record<AccountType, string> = { checking: 'Conta corrente', savings: 'Poupança', credit: 'Cartão de crédito' }

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
    </header>
  )
}

function ChoiceCard({ selected, disabled, onClick, icon, iconClassName, title, subtitle, badge }: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  iconClassName: string
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-20 w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/50',
        selected && 'border-primary bg-primary/5'
      )}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', iconClassName)}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          {title}
          {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
        </span>
        <span className="text-sm font-normal text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

// Wizard de "Nova conta" (estilo GranaZen, ver 7.29) — reproduz as etapas 1-3
// e 5 (renumerada) quase à risca (fork automática/manual, nome, saldo
// inicial+sinal, revisão), mas a etapa 4 real do GranaZen ("Esta será sua
// conta padrão?", pra lançamento via WhatsApp) não tem equivalente aqui —
// não existe bot de WhatsApp neste app. No lugar, duas etapas próprias (4 e
// 5) cobrem os campos que o `AccountForm` já exige e o GranaZen nem
// pergunta neste fluxo: tipo de conta (corrente/poupança/cartão, com os
// campos de cartão condicionais) e moeda+compartilhada. Confirmado com o
// usuário antes de implementar.
export function AccountWizard({ open, onOpenChange, profileId }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [step, setStep] = useState(1)
  const [accountKind, setAccountKind] = useState<AccountKind | null>(null)
  const [name, setName] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [balanceSign, setBalanceSign] = useState<BalanceSign>('positive')
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [creditLimit, setCreditLimit] = useState('')
  const [cardBrand, setCardBrand] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [currencyCode, setCurrencyCode] = useState('BRL')
  const [isShared, setIsShared] = useState(false)

  const isCredit = accountType === 'credit'
  const parsedBalance = parseFloat(fromMasked(openingBalance, currencyCode)) || 0
  const signedBalance = balanceSign === 'negative' ? -parsedBalance : parsedBalance

  function changeCurrency(next: string) {
    setOpeningBalance(reformatMasked(openingBalance, currencyCode, next))
    setCurrencyCode(next)
  }

  function canContinue() {
    if (step === 1) return accountKind === 'manual'
    if (step === 2) return name.trim().length > 0
    if (step === 4) return accountType !== null
    return true
  }

  function create() {
    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('financial_accounts').insert({
        profile_id: profileId,
        name: name.trim(),
        currency_code: currencyCode,
        account_type: accountType,
        is_shared: isShared,
        balance: isCredit ? 0 : signedBalance,
        created_by_user_id: user!.id,
        credit_limit: isCredit && creditLimit ? parseFloat(creditLimit) : null,
        closing_day: isCredit && closingDay ? parseInt(closingDay, 10) : null,
        due_day: isCredit && dueDay ? parseInt(dueDay, 10) : null,
        card_brand: isCredit ? (cardBrand || null) : null,
      })
      if (error) { toast.error('Erro ao criar conta.'); return }
      toast.success('Conta criada.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <Badge variant="secondary">Nova conta</Badge>
            <span className="text-xs text-muted-foreground">Etapa {step} de {TOTAL_STEPS}</span>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
          <DialogTitle className="sr-only">Nova conta</DialogTitle>
          <DialogDescription className="sr-only">Crie uma conta em etapas e revise antes de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5 py-1">
          {step === 1 && (
            <>
              <StepHeader title="Como você quer criar a conta?" subtitle="Escolha se a conta será manual ou automática via Open Finance." />
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Como você quer criar a conta?">
                <ChoiceCard
                  selected={false}
                  disabled
                  onClick={() => {}}
                  icon={<Landmark className="h-5 w-5" />}
                  iconClassName="bg-muted text-muted-foreground"
                  title="Conta automática"
                  subtitle="Conecte seu banco e sincronize os lançamentos."
                  badge="Em breve"
                />
                <ChoiceCard
                  selected={accountKind === 'manual'}
                  onClick={() => setAccountKind('manual')}
                  icon={<Wallet className="h-5 w-5" />}
                  iconClassName="bg-primary/10 text-primary"
                  title="Conta manual"
                  subtitle="Registre receitas e despesas manualmente."
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHeader title="Qual será o nome da conta?" subtitle="Informe o nome da sua conta bancária." />
              <div className="space-y-2">
                <Label>Nome da conta</Label>
                <Input autoFocus value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Ex.: Nubank, carteira ou conta conjunta" />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHeader title="Qual é o saldo inicial?" subtitle="Informe quanto há nesta conta hoje." />
              <div className="space-y-2">
                <Label>Saldo inicial</Label>
                <Input inputMode="numeric" value={openingBalance} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpeningBalance(toMasked(e.target.value, currencyCode))} placeholder="0,00" />
                <p className="text-xs text-muted-foreground">Informe apenas o valor, sem usar o sinal de menos.</p>
              </div>
              <div className="space-y-2">
                <Label>Como está o saldo?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBalanceSign('positive')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                      balanceSign === 'positive' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted/50'
                    )}
                  >
                    <CirclePlus className="h-4 w-4" /> Positivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceSign('negative')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                      balanceSign === 'negative' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted/50'
                    )}
                  >
                    <CircleMinus className="h-4 w-4" /> Negativo
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">O saldo será registrado como {balanceSign === 'positive' ? 'positivo' : 'negativo'}.</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepHeader title="Qual é o tipo de conta?" subtitle="Isso muda quais campos aparecem a seguir." />
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Qual é o tipo de conta?">
                <ChoiceCard selected={accountType === 'checking'} onClick={() => setAccountType('checking')} icon={<Landmark className="h-5 w-5" />} iconClassName="bg-primary/10 text-primary" title="Conta corrente" subtitle="Conta do dia a dia, débito ou dinheiro." />
                <ChoiceCard selected={accountType === 'savings'} onClick={() => setAccountType('savings')} icon={<PiggyBank className="h-5 w-5" />} iconClassName="bg-primary/10 text-primary" title="Poupança" subtitle="Reserva ou investimento simples." />
                <ChoiceCard selected={accountType === 'credit'} onClick={() => setAccountType('credit')} icon={<CreditCard className="h-5 w-5" />} iconClassName="bg-primary/10 text-primary" title="Cartão de crédito" subtitle="Fatura, limite e datas de fechamento/vencimento." />
              </div>
              {isCredit && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Limite total</Label>
                      <Input inputMode="decimal" value={creditLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreditLimit(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label>Bandeira</Label>
                      <select value={cardBrand} onChange={(e) => setCardBrand(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                        <option value="">Selecione</option>
                        {CARD_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Dia de fechamento</Label>
                      <Input type="number" min={1} max={31} value={closingDay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosingDay(e.target.value)} placeholder="Ex: 15" />
                    </div>
                    <div className="space-y-2">
                      <Label>Dia de vencimento</Label>
                      <Input type="number" min={1} max={31} value={dueDay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDay(e.target.value)} placeholder="Ex: 22" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <StepHeader title="Moeda e compartilhamento" subtitle="Últimos detalhes antes de revisar." />
              <div className="space-y-2">
                <Label>Moeda</Label>
                <select value={currencyCode} onChange={(e) => changeCurrency(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isShared} onCheckedChange={setIsShared} />
                Conta compartilhada (equipe/família)
              </label>
            </>
          )}

          {step === 6 && (
            <>
              <StepHeader title="Revise sua conta" subtitle="Confira os dados antes de criar." />
              <div className="space-y-4 rounded-xl border p-5">
                <Badge variant="secondary">Conta manual</Badge>
                <div>
                  <p className="text-xl font-semibold">{name || '-'}</p>
                  <p className="text-sm text-muted-foreground">Esta conta será criada sem conexão bancária.</p>
                </div>
                {!isCredit && (
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo inicial</p>
                    <p className="text-3xl font-semibold">{formatCurrency(signedBalance, currencyCode)}</p>
                  </div>
                )}
                <div className="h-px bg-border" />
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tipo</dt><dd>{accountType ? TYPE_LABEL[accountType] : '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Moeda</dt><dd>{currencyCode}</dd></div>
                  {isCredit && (
                    <>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Limite</dt><dd>{creditLimit ? formatCurrency(parseFloat(creditLimit), currencyCode) : '-'}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Bandeira</dt><dd>{cardBrand || '-'}</dd></div>
                    </>
                  )}
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Compartilhada</dt><dd>{isShared ? 'Sim' : 'Não'}</dd></div>
                </dl>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {step === 1 ? (
            <Button type="button" variant="ghost" className="gap-1.5" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Cancelar
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="gap-1.5" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button type="button" className="gap-1.5" disabled={!canContinue()} onClick={() => setStep((s) => s + 1)}>
              Continuar <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="button" className="gap-1.5" disabled={saving} onClick={create}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Criar conta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
