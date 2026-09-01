'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBroadcast } from '@/app/dashboard/parceiros/actions'
import { BroadcastRecipientFilter } from '@/types/database'
import { PartnerUpdateFinancial } from '@/lib/ai/generate-partner-update'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Megaphone, Loader2, Sparkles, Copy, Check, PartyPopper } from 'lucide-react'

const FILTER_LABEL: Record<BroadcastRecipientFilter, string> = {
  all: 'Todos os parceiros',
  financial: 'Só financeiro',
  prayer: 'Só oração',
  both: 'Financeiro e oração',
  ambassador: 'Só embaixadores',
}

type FinancialPeriodKey = '30d' | '90d'
const FINANCIAL_PERIODS: Record<FinancialPeriodKey, string> = {
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
}

function periodRange(key: FinancialPeriodKey) {
  const days = key === '30d' ? 30 : 90
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to), label: FINANCIAL_PERIODS[key] }
}

interface ActiveHighlight {
  id: string
  title: string
  goal_amount: number | null
  current_amount: number
  currency: string
  funding_deadline: string | null
}

interface Props {
  profileId: string
  activeHighlights: ActiveHighlight[]
  aiConfigured: boolean
  aiPlanIncluded: boolean
}

export function SendBroadcastButton({ profileId, activeHighlights, aiConfigured, aiPlanIncluded }: Props) {
  const aiEnabled = aiConfigured && aiPlanIncluded
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [filter, setFilter] = useState<BroadcastRecipientFilter>('all')
  const [sendByEmail, setSendByEmail] = useState(true)

  const [includeFinancial, setIncludeFinancial] = useState(false)
  const [financialPeriod, setFinancialPeriod] = useState<FinancialPeriodKey>('30d')
  const [financialSnapshot, setFinancialSnapshot] = useState<PartnerUpdateFinancial | null>(null)
  const [includeProjects, setIncludeProjects] = useState(false)
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<string[]>(() => activeHighlights.map((h) => h.id))

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function toggleHighlight(id: string) {
    setSelectedHighlightIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]))
  }

  function resetForm() {
    setSubject('')
    setBody('')
    setFilter('all')
    setSendByEmail(true)
    setIncludeFinancial(false)
    setFinancialSnapshot(null)
    setIncludeProjects(false)
    setShareUrl(null)
    setCopied(false)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-partner-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          draftText: body,
          financialPeriod: includeFinancial ? periodRange(financialPeriod) : null,
          highlightIds: includeProjects ? selectedHighlightIds : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'insufficient_ai_credits') {
          toast.error('Créditos de IA insuficientes.', { action: { label: 'Ver planos', onClick: () => router.push('/planos') } })
        } else {
          toast.error('Erro ao gerar com IA.')
        }
        return
      }
      setBody(data.body)
      setFinancialSnapshot(data.financial ?? null)
    } catch {
      toast.error('Erro ao gerar com IA.')
    }
    setGenerating(false)
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSending(true)
    try {
      const { recipientCount, shareUrl: url } = await createBroadcast(
        subject,
        body,
        filter,
        includeProjects ? selectedHighlightIds : [],
        includeFinancial ? financialSnapshot : null,
        sendByEmail
      )
      if (sendByEmail && recipientCount === 0) {
        toast.error('Nenhum parceiro encontrado com esse filtro (ou ninguém com e-mail cadastrado).')
      } else if (sendByEmail) {
        toast.success(`Atualização enviada para ${recipientCount} parceiro(s). O envio por e-mail acontece em alguns minutos.`)
        setShareUrl(url)
      } else {
        toast.success('Link gerado!')
        setShareUrl(url)
      }
    } catch {
      toast.error('Erro ao enviar atualização.')
    }
    setSending(false)
  }

  async function handleCopyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canGenerate = includeFinancial || includeProjects

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Megaphone className="h-4 w-4 mr-2" />
        Criar atualização
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          {shareUrl ? (
            <div className="space-y-4 text-center py-2">
              <PartyPopper className="h-8 w-8 text-primary mx-auto" />
              <div>
                <p className="font-semibold">{sendByEmail ? 'Atualização a caminho!' : 'Página pronta!'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {sendByEmail
                    ? 'Também gerei uma página com essa atualização — copia o link e manda pelo WhatsApp pra quem preferir ler por lá.'
                    : 'Copia o link abaixo e manda pra quem quiser, por WhatsApp ou onde preferir.'}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-2">
                <p className="text-xs text-muted-foreground truncate flex-1 text-left">{shareUrl}</p>
                <Button type="button" variant="outline" size="icon-sm" onClick={handleCopyLink}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setOpen(false); resetForm() }}>Concluir</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Criar atualização</DialogTitle>
                <DialogDescription>Gera sempre uma página pra compartilhar (por WhatsApp, por exemplo) — mandar por e-mail pra rede de parceiros é opcional.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSend} className="space-y-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer rounded-xl border p-3">
                  <input type="checkbox" checked={sendByEmail} onChange={(e) => setSendByEmail(e.target.checked)} />
                  Também enviar por e-mail pros parceiros
                </label>

                {sendByEmail && (
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-filter">Destinatários</Label>
                    <select
                      id="broadcast-filter"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as BroadcastRecipientFilter)}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {Object.entries(FILTER_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="broadcast-subject">Assunto</Label>
                  <Input
                    id="broadcast-subject"
                    value={subject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                    placeholder="Ex.: Novidades da missão em setembro"
                    required
                  />
                </div>

                <div className="rounded-xl border p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Blocos opcionais (a IA tece tudo num texto só)
                    {!aiConfigured && <span className="font-normal">— em breve</span>}
                    {aiConfigured && !aiPlanIncluded && (
                      <button type="button" onClick={() => router.push('/planos')} className="font-normal underline underline-offset-2">
                        — disponível no Pro
                      </button>
                    )}
                  </p>

                  <fieldset disabled={!aiEnabled} className={cn('space-y-3', !aiEnabled && 'opacity-40')}>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={includeFinancial} onChange={(e) => setIncludeFinancial(e.target.checked)} />
                        Prestação de contas (o que foi arrecadado/gasto)
                      </label>
                      {includeFinancial && (
                        <select
                          value={financialPeriod}
                          onChange={(e) => setFinancialPeriod(e.target.value as FinancialPeriodKey)}
                          className="ml-6 h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none"
                        >
                          {Object.entries(FINANCIAL_PERIODS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={includeProjects} onChange={(e) => setIncludeProjects(e.target.checked)} />
                        Projetos em destaque (meta, progresso, o que falta)
                      </label>
                      {includeProjects && (
                        <div className="ml-6 space-y-1">
                          {activeHighlights.length === 0 && <p className="text-xs text-muted-foreground">Nenhum projeto ativo.</p>}
                          {activeHighlights.map((h) => (
                            <label key={h.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={selectedHighlightIds.includes(h.id)} onChange={() => toggleHighlight(h.id)} />
                              {h.title}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {canGenerate && (
                      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={handleGenerate} disabled={generating}>
                        {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                        Gerar com IA
                      </Button>
                    )}
                  </fieldset>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-body">Mensagem</Label>
                  <Textarea
                    id="broadcast-body"
                    value={body}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                    placeholder="Escreva a atualização, ou marque um bloco acima e gere com IA..."
                    className="min-h-32"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={sending}>
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {sendByEmail ? 'Enviar' : 'Gerar link'}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
