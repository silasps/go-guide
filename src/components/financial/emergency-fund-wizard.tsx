'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, CircleCheck, Info, Loader2 } from 'lucide-react'

export const EMERGENCY_FUND_GOAL_NAME = 'Reserva de emergência'

interface WizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  currency: string
}

type IncomeType = 'fixed' | 'variable'

const TOTAL_STEPS = 6

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

// Card de entrada da tela de Metas (estilo GranaZen, ver 7.28) — some quando
// já existe uma meta com esse nome exato, virando um card normal na lista.
export function EmergencyFundCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <Badge variant="secondary">Reserva de emergência</Badge>
      <div>
        <h3 className="text-base font-semibold">Crie sua reserva de emergência</h3>
        <p className="text-sm text-muted-foreground">Calcule quanto guardar e em quanto tempo.</p>
      </div>
      <Button className="gap-1.5" onClick={onStart}>
        Criar reserva <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
    </header>
  )
}

function IncomeOption({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
      )}
    >
      <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-primary' : 'border-muted-foreground/40')}>
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

function ProtectionPreview({ subtitle, monthsProtected, pct, saved, target, etaMonths, currency }: {
  subtitle: string
  monthsProtected: number
  pct: number
  saved: number
  target: number
  etaMonths: number | null
  currency: string
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="font-semibold leading-none tracking-tight">Sua proteção</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Proteção atual</p>
            <div className="flex items-baseline gap-1 text-3xl font-semibold">
              {monthsProtected}<span className="text-sm font-medium text-muted-foreground">mês</span>
            </div>
          </div>
          <span className="text-sm font-medium text-muted-foreground">{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{formatCurrency(saved, currency)}</span>
          <span>{formatCurrency(target, currency)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-start justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Prazo estimado</span>
          <span className="text-right font-medium">{etaMonths ? `${etaMonths} ${etaMonths === 1 ? 'mês' : 'meses'}` : 'Sem previsão'}</span>
        </div>
      </div>
    </div>
  )
}

const PREVIEW_SUBTITLE: Record<number, string> = {
  1: 'Veja sua proteção ganhar forma a cada resposta.',
  2: 'Seu custo mensal é a base do cálculo.',
  3: 'O tipo de renda define o prazo ideal de cobertura.',
  4: 'O valor guardado já conta como proteção atual.',
  5: 'Isso ajuda a estimar quando você chega lá.',
}

// Calculadora de reserva de emergência (estilo GranaZen, ver 7.28) — wizard
// de 6 passos que termina criando uma `FinancialGoal` normal chamada
// "Reserva de emergência" (reaproveita toda a infra de metas já existente —
// Visão geral, contribuições, edição — em vez de uma tabela/conceito novo).
// Alvo = custo fixo mensal × 6 (CLT) ou × 12 (renda variável); o "tipo de
// renda" só define esse multiplicador e não é salvo em lugar nenhum,
// igual à referência. Prazo estimado (quando há valor/mês informado) vira
// `target_date` da meta; sem valor/mês, a meta fica sem prazo.
export function EmergencyFundWizard({ open, onOpenChange, profileId, currency }: WizardProps) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [step, setStep] = useState(1)
  const [monthlyCost, setMonthlyCost] = useState('')
  const [incomeType, setIncomeType] = useState<IncomeType | null>(null)
  const [savedAmount, setSavedAmount] = useState('')
  const [monthlyContribution, setMonthlyContribution] = useState('')

  const months = incomeType === 'variable' ? 12 : 6
  const cost = parseFloat(fromMasked(monthlyCost)) || 0
  const saved = parseFloat(fromMasked(savedAmount)) || 0
  const contribution = parseFloat(fromMasked(monthlyContribution)) || 0
  const target = cost * months
  const missing = Math.max(0, target - saved)
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0
  const monthsProtected = cost > 0 ? Math.floor(saved / cost) : 0
  const etaMonths = contribution > 0 && missing > 0 ? Math.ceil(missing / contribution) : null

  function canContinue() {
    if (step === 2) return cost > 0
    if (step === 3) return incomeType !== null
    return true
  }

  function create() {
    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const targetDate = etaMonths
        ? new Date(Date.now() + etaMonths * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null

      const { error } = await supabase.from('financial_goals').insert({
        profile_id: profileId,
        created_by_user_id: user!.id,
        name: EMERGENCY_FUND_GOAL_NAME,
        target_amount: target,
        current_amount: saved,
        currency,
        target_date: targetDate,
      })
      if (error) { toast.error('Erro ao criar reserva.'); return }
      toast.success('Reserva de emergência criada.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <Badge variant="secondary">Reserva de emergência</Badge>
            <span className="text-xs text-muted-foreground">Etapa {step} de {TOTAL_STEPS}</span>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
          <DialogTitle className="sr-only">Reserva de emergência</DialogTitle>
          <DialogDescription className="sr-only">Calcule quanto guardar e em quanto tempo.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-1 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
          <div className="min-w-0 space-y-5">
            {step === 1 && (
              <>
                <StepHeader title="Vamos calcular sua reserva?" subtitle="Leva poucos minutos." />
                <p className="text-sm text-muted-foreground sm:text-base">Informe seus gastos, seu tipo de renda e quanto consegue guardar.</p>
                <ul className="flex flex-col gap-3">
                  {['Valor total da reserva.', 'Quantidade de meses protegidos.', 'Prazo para atingir a meta.'].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {step === 2 && (
              <>
                <StepHeader title="Qual é o seu custo fixo por mês?" subtitle="Considere apenas os gastos essenciais." />
                <div className="space-y-2">
                  <Label>Custo fixo mensal</Label>
                  <Input inputMode="numeric" autoFocus value={monthlyCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonthlyCost(toMasked(e.target.value))} placeholder="0,00" />
                  <p className="text-xs text-muted-foreground">Moradia, alimentação, saúde, transporte e contas.</p>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <StepHeader title="Como você recebe sua renda?" subtitle="Isso define se a reserva terá 6 ou 12 meses." />
                <div className="space-y-2">
                  <Label>Tipo de renda</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <IncomeOption selected={incomeType === 'fixed'} onClick={() => setIncomeType('fixed')} title="Salário fixo (CLT)" subtitle="Reserva para 6 meses." />
                    <IncomeOption selected={incomeType === 'variable'} onClick={() => setIncomeType('variable')} title="Renda variável (PJ ou autônomo)" subtitle="Reserva para 12 meses." />
                  </div>
                  <p className="text-xs text-muted-foreground">Essa informação não será salva.</p>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <StepHeader title="Quanto você já tem guardado?" subtitle="Informe apenas o valor desta reserva." />
                <div className="space-y-2">
                  <Label>Valor guardado</Label>
                  <Input inputMode="numeric" autoFocus value={savedAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSavedAmount(toMasked(e.target.value))} placeholder="0,00" />
                  <p className="text-xs text-muted-foreground">Use zero se ainda não começou.</p>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <StepHeader title="Quanto você consegue guardar por mês?" subtitle="Esse valor será usado para calcular o prazo." />
                <div className="space-y-2">
                  <Label>Valor por mês</Label>
                  <Input inputMode="numeric" autoFocus value={monthlyContribution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonthlyContribution(toMasked(e.target.value))} placeholder="0,00" />
                  <p className="text-xs text-muted-foreground">Use zero para criar sem prazo.</p>
                </div>
              </>
            )}

            {step === 6 && (
              <>
                <StepHeader title="Os valores estão corretos?" subtitle="Revise antes de criar a meta." />
                <div className="space-y-4 rounded-xl border p-5">
                  <div>
                    <p className="font-semibold">Resumo da reserva</p>
                    <p className="text-sm text-muted-foreground">Você poderá editar a meta depois.</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor da reserva</p>
                    <p className="text-3xl font-semibold">{formatCurrency(target, currency)}</p>
                  </div>
                  <div className="h-px bg-border" />
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Custo fixo mensal</dt><dd>{formatCurrency(cost, currency)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Meses de reserva</dt><dd>{months} meses</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Valor guardado</dt><dd>{formatCurrency(saved, currency)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Valor por mês</dt><dd>{formatCurrency(contribution, currency)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Prazo estimado</dt><dd>{etaMonths ? `${etaMonths} ${etaMonths === 1 ? 'mês' : 'meses'}` : 'Sem previsão'}</dd></div>
                  </dl>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p><span className="font-medium text-foreground">Sobre o prazo. </span>O cálculo não considera rendimentos, apenas os aportes mensais informados.</p>
                </div>
              </>
            )}
          </div>

          {step < TOTAL_STEPS && (
            <aside className="hidden lg:block">
              <ProtectionPreview subtitle={PREVIEW_SUBTITLE[step]} monthsProtected={monthsProtected} pct={pct} saved={saved} target={target} etaMonths={etaMonths} currency={currency} />
            </aside>
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
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Criar reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
