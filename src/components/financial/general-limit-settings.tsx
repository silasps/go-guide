'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { GeneralSpendingLimit, GeneralSpendingLimitMode } from '@/types/database'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Coins, Link2, Circle, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  profileId: string
  settings: GeneralSpendingLimit | null
  categoriesTotal: number
  currency: string
}

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

interface PatchPayload {
  enabled?: boolean
  mode?: GeneralSpendingLimitMode
  manual_amount?: number | null
  notify_enabled?: boolean
  notify_threshold_pct?: number
}

// Card "Limite geral de gasto" estilo GranaZen — configuração persistida
// em `general_spending_limits` (migration 097, UNIQUE por perfil), lida
// junto com `spending_limits` em `page.tsx`. Sem botão "Salvar": cada
// controle grava sozinho (upsert) ao mudar, igual ao HTML de referência
// (nenhum botão de submit lá) — `router.refresh()` depois de cada save
// repassa o valor novo pro `GeneralLimitOverview` irmão (ver
// `SpendingLimitsTabs`), que só lê a prop `settings`, sem estado próprio.
export function GeneralLimitSettings({ profileId, settings, categoriesTotal, currency }: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [mode, setMode] = useState<GeneralSpendingLimitMode>(settings?.mode ?? 'sum_categories')
  const [manualAmount, setManualAmount] = useState<number | null>(settings?.manual_amount ?? null)
  const [manualInput, setManualInput] = useState(settings?.manual_amount ? toMasked(String(Math.round(settings.manual_amount * 100))) : '')
  const [notifyEnabled, setNotifyEnabled] = useState(settings?.notify_enabled ?? true)
  const [threshold, setThreshold] = useState(settings?.notify_threshold_pct ?? 100)

  function save(patch: PatchPayload) {
    const payload = {
      profile_id: profileId,
      currency,
      enabled: patch.enabled ?? enabled,
      mode: patch.mode ?? mode,
      manual_amount: 'manual_amount' in patch ? patch.manual_amount : manualAmount,
      notify_enabled: patch.notify_enabled ?? notifyEnabled,
      notify_threshold_pct: patch.notify_threshold_pct ?? threshold,
    }
    const supabase = createClient()
    supabase.from('general_spending_limits').upsert(payload, { onConflict: 'profile_id' }).then(({ error }) => {
      if (error) { toast.error('Erro ao salvar limite geral.'); return }
      router.refresh()
    })
  }

  function selectMode(next: GeneralSpendingLimitMode) {
    setMode(next)
    save({ mode: next })
  }

  function commitManualAmount() {
    const parsed = manualInput ? parseFloat(fromMasked(manualInput)) : null
    setManualAmount(parsed)
    save({ manual_amount: parsed })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Limite geral de gasto</CardTitle>
        <CardDescription>Escolha como calcular o limite geral: valor único para tudo ou soma dos limites por categoria.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
          <label htmlFor="generalLimitSwitch" className="text-sm font-semibold">Ativar limite geral</label>
          <Switch id="generalLimitSwitch" checked={enabled} onCheckedChange={(v: boolean) => { setEnabled(v); save({ enabled: v }) }} />
        </div>

        {!enabled && (
          <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">Limite geral desativado.</p>
        )}

        {enabled && (
          <>
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Como deseja calcular o limite geral?</p>
                <p className="text-xs leading-5 text-muted-foreground">Escolha apenas uma opção. Ao selecionar uma, a outra fica desconsiderada.</p>
              </div>

              <div
                role="radio"
                aria-checked={mode === 'manual'}
                tabIndex={0}
                onClick={() => selectMode('manual')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectMode('manual')}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 outline-none transition-colors',
                  mode === 'manual' ? 'border-primary bg-primary/[0.03] ring-1 ring-primary/25' : 'border-border/70 bg-background hover:bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  {mode === 'manual' ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Coins className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-semibold">Usar valor geral único</span>
                      {mode === 'manual' && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Selecionado</span>}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">Você define manualmente um único valor para todos os gastos.</p>
                    {mode === 'manual' && (
                      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                        <Input inputMode="numeric" value={manualInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualInput(toMasked(e.target.value))} onBlur={commitManualAmount} placeholder="0,00" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                role="radio"
                aria-checked={mode === 'sum_categories'}
                tabIndex={0}
                onClick={() => selectMode('sum_categories')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectMode('sum_categories')}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 outline-none transition-colors',
                  mode === 'sum_categories' ? 'border-primary bg-primary/[0.03] ring-1 ring-primary/25' : 'border-border/70 bg-background hover:bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  {mode === 'sum_categories' ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-semibold">Usar valor total do limite de gasto por categoria</span>
                      {mode === 'sum_categories' && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Selecionado</span>}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">Quando ativado, o limite geral vira a soma das categorias com limite e ignora o valor único.</p>
                    {mode === 'sum_categories' && (
                      <div className="mt-2 rounded-lg border bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">Total atual das categorias com limite</p>
                        <p className="text-base font-semibold tabular-nums">{formatCurrency(categoriesTotal, currency)}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">O valor está sendo calculado automaticamente pelo total dos limites por categoria.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
              <label htmlFor="generalNotifySwitch" className="text-sm font-semibold">Ativar aviso de limite</label>
              <Switch id="generalNotifySwitch" checked={notifyEnabled} onCheckedChange={(v: boolean) => { setNotifyEnabled(v); save({ notify_enabled: v }) }} />
            </div>

            {notifyEnabled && (
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                <label htmlFor="generalNotifyPercentage" className="text-sm font-medium">Avisar quando ultrapassar {threshold}%</label>
                <div className="flex items-center gap-3">
                  <input
                    id="generalNotifyPercentage"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={threshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThreshold(Number(e.target.value))}
                    onMouseUp={(e) => save({ notify_threshold_pct: Number((e.target as HTMLInputElement).value) })}
                    onTouchEnd={(e) => save({ notify_threshold_pct: Number((e.target as HTMLInputElement).value) })}
                    className="w-full"
                  />
                  <span className="min-w-[44px] text-right text-sm font-medium">{threshold}%</span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
