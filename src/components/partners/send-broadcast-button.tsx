'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBroadcast } from '@/app/dashboard/parceiros/actions'
import { BroadcastRecipientFilter, FinancialVisibility } from '@/types/database'
import { PartnerUpdateFinancial } from '@/lib/ai/generate-partner-update'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Megaphone, FileText, Loader2, Sparkles, LayoutTemplate, Copy, Check, PartyPopper } from 'lucide-react'

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

// Atalho do modo 'report' (aba Relatórios) — assunto pré-preenchido em vez
// de vazio, pra reduzir digitação de quem só quer publicar a prestação de
// contas do mês. Continua editável.
function defaultReportSubject() {
  const label = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return `Prestação de contas — ${label.charAt(0).toUpperCase() + label.slice(1)}`
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
  /** 'campaign' (default) = compositor completo, usado em /dashboard/parceiros.
   *  'report' = atalho da aba Prestações (/dashboard/financeiro/prestacoes):
   *  bloco financeiro sempre ligado (sem checkbox), sem bloco de projetos,
   *  assunto pré-preenchido, não manda e-mail por padrão. */
  mode?: 'campaign' | 'report'
  activeHighlights?: ActiveHighlight[]
  aiConfigured: boolean
  aiPlanIncluded: boolean
}

export function SendBroadcastButton({ profileId, mode = 'campaign', activeHighlights = [], aiConfigured, aiPlanIncluded }: Props) {
  const isReportMode = mode === 'report'
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [generatingMode, setGeneratingMode] = useState<'ai' | 'template' | null>(null)
  const [subject, setSubject] = useState(() => (isReportMode ? defaultReportSubject() : ''))
  const [body, setBody] = useState('')
  const [filter, setFilter] = useState<BroadcastRecipientFilter>('all')
  const [sendByEmail, setSendByEmail] = useState(!isReportMode)

  const [includeFinancial, setIncludeFinancial] = useState(isReportMode)
  const [financialPeriod, setFinancialPeriod] = useState<FinancialPeriodKey>('30d')
  const [financialVisibility, setFinancialVisibility] = useState<FinancialVisibility>('exact')
  const [financialSnapshot, setFinancialSnapshot] = useState<PartnerUpdateFinancial | null>(null)
  const [includeProjects, setIncludeProjects] = useState(false)
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<string[]>(() => activeHighlights.map((h) => h.id))

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function toggleHighlight(id: string) {
    setSelectedHighlightIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]))
  }

  function resetForm() {
    setSubject(isReportMode ? defaultReportSubject() : '')
    setBody('')
    setFilter('all')
    setSendByEmail(!isReportMode)
    setIncludeFinancial(isReportMode)
    setFinancialVisibility('exact')
    setFinancialSnapshot(null)
    setIncludeProjects(false)
    setShareUrl(null)
    setCopied(false)
  }

  async function handleGenerate(mode: 'ai' | 'template') {
    setGeneratingMode(mode)
    try {
      const res = await fetch('/api/ai/generate-partner-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          draftText: body,
          financialPeriod: includeFinancial ? periodRange(financialPeriod) : null,
          financialVisibility,
          highlightIds: includeProjects ? selectedHighlightIds : [],
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'insufficient_ai_credits') {
          toast.error('Créditos de IA insuficientes.', { action: { label: 'Ver planos', onClick: () => router.push('/planos') } })
        } else {
          toast.error(mode === 'ai' ? 'Erro ao gerar com IA.' : 'Erro ao montar o informativo.')
        }
        return
      }
      setBody(data.body)
      setFinancialSnapshot(data.financial ?? null)
    } catch {
      toast.error(mode === 'ai' ? 'Erro ao gerar com IA.' : 'Erro ao montar o informativo.')
    }
    setGeneratingMode(null)
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
        sendByEmail,
        includeFinancial ? financialVisibility : 'exact'
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
        {isReportMode ? <FileText className="h-4 w-4 mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
        {isReportMode ? 'Nova prestação de contas' : 'Criar atualização'}
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          {shareUrl ? (
            <div className="space-y-4 text-center py-2 min-w-0">
              <PartyPopper className="h-8 w-8 text-primary mx-auto" />
              <div>
                <p className="font-semibold">{sendByEmail ? 'Atualização a caminho!' : 'Página pronta!'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {sendByEmail
                    ? 'Também gerei uma página com essa atualização — copia o link e manda pelo WhatsApp pra quem preferir ler por lá.'
                    : 'Copia o link abaixo e manda pra quem quiser, por WhatsApp ou onde preferir.'}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-2 min-w-0">
                <p className="text-xs text-muted-foreground break-all flex-1 min-w-0 text-left">{shareUrl}</p>
                <Button type="button" variant="outline" size="icon-sm" className="shrink-0" onClick={handleCopyLink}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setOpen(false); resetForm(); router.refresh() }}>Concluir</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{isReportMode ? 'Nova prestação de contas' : 'Criar atualização'}</DialogTitle>
                <DialogDescription>
                  {isReportMode
                    ? 'Gera uma página pra compartilhar o que foi arrecadado/gasto — mandar por e-mail pra rede de parceiros é opcional.'
                    : 'Gera sempre uma página pra compartilhar (por WhatsApp, por exemplo) — mandar por e-mail pra rede de parceiros é opcional.'}
                </DialogDescription>
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
                  <p className="text-xs font-medium text-muted-foreground">
                    {isReportMode ? 'O que incluir' : 'Blocos (o sistema monta o texto pra você)'}
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      {isReportMode ? (
                        <p className="text-sm font-medium">Prestação de contas (o que foi arrecadado/gasto)</p>
                      ) : (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={includeFinancial} onChange={(e) => setIncludeFinancial(e.target.checked)} />
                          Prestação de contas (o que foi arrecadado/gasto)
                        </label>
                      )}
                      {includeFinancial && (
                        <div className="ml-6 space-y-2">
                          <select
                            value={financialPeriod}
                            onChange={(e) => setFinancialPeriod(e.target.value as FinancialPeriodKey)}
                            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none"
                          >
                            {Object.entries(FINANCIAL_PERIODS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <div className="space-y-1">
                            <label className="flex items-start gap-2 text-xs cursor-pointer">
                              <input type="radio" name="financial-visibility" className="mt-0.5" checked={financialVisibility === 'exact'} onChange={() => setFinancialVisibility('exact')} />
                              <span>Valores exatos <span className="text-muted-foreground">— qualquer pessoa com o link vê (padrão)</span></span>
                            </label>
                            <label className="flex items-start gap-2 text-xs cursor-pointer">
                              <input type="radio" name="financial-visibility" className="mt-0.5" checked={financialVisibility === 'percent_only'} onChange={() => setFinancialVisibility('percent_only')} />
                              <span>Só percentuais <span className="text-muted-foreground">— mais privado; valor exato fica reservado a parceiros autorizados</span></span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isReportMode && (
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
                    )}

                    {canGenerate && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => handleGenerate('template')} disabled={generatingMode !== null}>
                          {generatingMode === 'template' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <LayoutTemplate className="mr-2 h-3.5 w-3.5" />}
                          Montar informativo
                        </Button>
                        {aiConfigured && (
                          aiPlanIncluded ? (
                            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => handleGenerate('ai')} disabled={generatingMode !== null}>
                              {generatingMode === 'ai' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                              Gerar com IA
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => router.push('/planos')}>
                              <Sparkles className="mr-2 h-3.5 w-3.5" />
                              Gerar com IA — Pro
                            </Button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-body">Mensagem</Label>
                  <Textarea
                    id="broadcast-body"
                    value={body}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                    placeholder="Escreva a atualização, ou marque um bloco acima e monte automaticamente..."
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
