'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency } from '@/lib/utils'
import { parseOfx, readOfxFile, ParsedStatementTransaction } from '@/lib/statement-import/ofx'
import { FinancialAccount } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Upload, Loader2, ArrowLeft, FileUp, HelpCircle } from 'lucide-react'

const BANK_HINTS: { name: string; steps: string }[] = [
  { name: 'Nubank', steps: 'App → Conta → Extrato → ícone de exportar (topo da tela) → escolher período → formato OFX' },
  { name: 'Itaú', steps: 'Internet Banking → Extrato → "Exportar extrato" → formato OFX' },
  { name: 'Bradesco', steps: 'Internet Banking → Extrato → Exportar → OFX' },
  { name: 'Banco do Brasil', steps: 'Internet Banking → Extrato → Exportar/Salvar → formato Money (OFX)' },
  { name: 'Santander', steps: 'Internet Banking → Extrato → Exportar extrato → OFX' },
  { name: 'Caixa', steps: 'Internet Banking → Extrato de conta → Exportar → OFX' },
  { name: 'Banco Inter', steps: 'App → Extrato → compartilhar/exportar → OFX' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  account: FinancialAccount
}

const CHUNK_SIZE = 200

// Alternativa gratuita ao Open Finance (seção 7.32/7.33) — sem nenhuma API
// paga envolvida: o usuário baixa o extrato OFX do próprio internet
// banking (toda instituição brasileira oferece essa exportação) e sobe
// aqui. Só contas corrente/poupança por ora — o sinal de `TRNAMT` em OFX de
// cartão de crédito varia entre emissores (alguns exportam compra como
// negativo, outros como positivo), então importar fatura ficou de fora
// deliberadamente pra não arriscar lançamento com sinal trocado (o card de
// conta de crédito, em `AccountCard`, nem oferece este botão).
//
// Sempre escopado a uma conta (aberto a partir do card dela, estilo
// GranaZen) — antes era um seletor de conta solto no topo da lista; virou
// controlado por fora (`open`/`onOpenChange`, mesmo padrão de
// `AccountWizard`/`TransferDialog`) porque não sobrou nenhum outro chamador
// que precisasse escolher a conta dentro do próprio dialog.
export function ImportStatementDialog({ open, onOpenChange, profileId, account }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedStatementTransaction[] | null>(null)
  const [newUids, setNewUids] = useState<Set<string>>(new Set())
  const { isPending: loadingFile, run: runLoad } = usePendingAction()
  const { isPending: importing, run: runImport } = usePendingAction()

  function reset() {
    setFileName('')
    setParsed(null)
    setNewUids(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    runLoad(true, async () => {
      const text = await readOfxFile(file)
      const transactions = parseOfx(text)
      if (transactions.length === 0) {
        toast.error('Nenhum lançamento reconhecido nesse arquivo. Confirme que é um extrato OFX.')
        reset()
        return
      }

      const supabase = createClient()
      const { data: existing } = await supabase
        .from('transactions')
        .select('import_uid')
        .eq('account_id', account.id)
        .not('import_uid', 'is', null)
      const existingUids = new Set((existing ?? []).map((t) => t.import_uid as string))

      setParsed(transactions)
      setNewUids(new Set(transactions.filter((t) => !existingUids.has(t.uid)).map((t) => t.uid)))
    })
  }

  function confirmImport() {
    if (!parsed) return
    runImport(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const toInsert = parsed.filter((t) => newUids.has(t.uid)).map((t) => ({
        account_id: account.id,
        profile_id: profileId,
        created_by_user_id: user!.id,
        type: t.type,
        amount: t.amount,
        currency: account.currency_code,
        description: t.description,
        source: 'import' as const,
        is_paid: true,
        date: t.date,
        import_uid: t.uid,
      }))

      for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const { error } = await supabase.from('transactions').insert(toInsert.slice(i, i + CHUNK_SIZE))
        if (error) { toast.error('Erro ao importar lançamentos.'); return }
      }

      toast.success(`${toInsert.length} lançamento${toInsert.length === 1 ? '' : 's'} importado${toInsert.length === 1 ? '' : 's'}.`)
      onOpenChange(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar extrato (OFX)</DialogTitle>
          <DialogDescription>Baixe o extrato de {account.name} no internet banking do seu banco (formato OFX) e envie aqui.</DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-4">
            <details className="group rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium marker:content-none">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" /> Como baixar o extrato OFX do meu banco?
              </summary>
              <div className="mt-2.5 space-y-2.5 text-muted-foreground">
                <p>No geral: entre no Extrato/Histórico do internet banking ou app, procure um ícone de exportar/baixar (às vezes dentro de um menu &ldquo;…&rdquo; ou &ldquo;Compartilhar&rdquo;) e escolha o formato <strong>OFX</strong> — pode aparecer como &ldquo;Money&rdquo; ou &ldquo;Quicken&rdquo;, os softwares que popularizaram esse formato.</p>
                <ul className="space-y-1">
                  {BANK_HINTS.map((b) => (
                    <li key={b.name}><strong className="text-foreground">{b.name}:</strong> {b.steps}</li>
                  ))}
                </ul>
                <p>Os passos exatos variam conforme a versão do app de cada banco. Alguns bancos digitais oferecem só PDF ou CSV — nesses casos ainda não dá pra importar automaticamente por aqui.</p>
              </div>
            </details>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/50">
              {loadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
              <span>{fileName || 'Clique para escolher o arquivo .ofx'}</span>
              <input ref={fileInputRef} type="file" accept=".ofx,.qfx" className="hidden" disabled={loadingFile} onChange={handleFile} />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{newUids.size} novo{newUids.size === 1 ? '' : 's'}</Badge>
              {parsed.length - newUids.size > 0 && (
                <Badge variant="outline">{parsed.length - newUids.size} já importado{parsed.length - newUids.size === 1 ? '' : 's'}</Badge>
              )}
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
              {parsed.map((t) => (
                <div key={t.uid} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${!newUids.has(t.uid) ? 'opacity-40' : ''}`}>
                  <div className="min-w-0">
                    <p className="truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date.split('-').reverse().join('/')}</p>
                  </div>
                  <span className={t.type === 'income' ? 'shrink-0 text-emerald-600' : 'shrink-0 text-red-600'}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, account.currency_code)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {parsed ? (
            <Button type="button" variant="ghost" className="gap-1.5" onClick={reset}>
              <ArrowLeft className="h-3.5 w-3.5" /> Escolher outro arquivo
            </Button>
          ) : <span />}
          {parsed && (
            <Button type="button" className="gap-1.5" disabled={importing || newUids.size === 0} onClick={confirmImport}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Importar {newUids.size} lançamento{newUids.size === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
