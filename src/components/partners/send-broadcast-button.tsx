'use client'

import { useState } from 'react'
import { createBroadcast } from '@/app/dashboard/parceiros/actions'
import { BroadcastRecipientFilter } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Megaphone, Loader2 } from 'lucide-react'

const FILTER_LABEL: Record<BroadcastRecipientFilter, string> = {
  all: 'Todos os parceiros',
  financial: 'Só financeiro',
  prayer: 'Só oração',
  both: 'Só ambos',
  ambassador: 'Só embaixadores',
}

export function SendBroadcastButton() {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [filter, setFilter] = useState<BroadcastRecipientFilter>('all')

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSending(true)
    try {
      const { recipientCount } = await createBroadcast(subject, body, filter)
      if (recipientCount === 0) {
        toast.error('Nenhum parceiro encontrado com esse filtro (ou ninguém com e-mail cadastrado).')
      } else {
        toast.success(`Atualização enviada para ${recipientCount} parceiro(s). O envio acontece em alguns minutos.`)
        setSubject('')
        setBody('')
        setFilter('all')
        setOpen(false)
      }
    } catch {
      toast.error('Erro ao enviar atualização.')
    }
    setSending(false)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Megaphone className="h-4 w-4 mr-2" />
        Enviar atualização
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar atualização pros parceiros</DialogTitle>
            <DialogDescription>Manda um e-mail avulso pra sua rede de parceiros, fora do fluxo normal de posts.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSend} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="broadcast-body">Mensagem</Label>
              <Textarea
                id="broadcast-body"
                value={body}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                placeholder="Escreva a atualização..."
                className="min-h-32"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
