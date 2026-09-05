'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, CheckCircle, HandHeart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  profileId: string
  highlightId: string
  prayerPointId?: string | null
  missionaryName: string
  /** Rótulo do botão que abre o modal — muda entre "Orar por este projeto"
   *  (geral, botão grande) e "Orar por isso" (ponto específico, pequeno). */
  triggerLabel: string
  triggerClassName?: string
}

/** Reaproveita a mesma lógica de submit de PrayerRequestForm (exige login,
 *  insere em prayer_requests com requester_type='partner'), só que já
 *  escopado a um projeto/ponto — sem a opção de oração privada/cifrada do
 *  formulário genérico, pra manter o modal leve. */
export function PrayForPointModal({ profileId, highlightId, prayerPointId, missionaryName, triggerLabel, triggerClassName }: Props) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Faça login para enviar uma oração.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('prayer_requests').insert({
      profile_id: profileId,
      requester_id: user.id,
      requester_type: 'partner',
      content: content.trim(),
      highlight_id: highlightId,
      prayer_point_id: prayerPointId ?? null,
    })

    setSaving(false)
    if (error) { toast.error('Erro ao enviar. Tente novamente.'); return }
    setDone(true)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // reseta pro próximo uso, com um pequeno atraso pra não "piscar" o
      // formulário vazio durante a animação de fechar
      setTimeout(() => { setDone(false); setContent('') }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName ?? cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
        <HandHeart className="h-3.5 w-3.5" /> {triggerLabel}
      </button>
      <DialogContent className="max-w-sm">
        <DialogTitle>{done ? 'Oração enviada!' : 'Orar por este projeto'}</DialogTitle>
        {!done && <DialogDescription>Escreva uma oração de apoio — {missionaryName} vai receber.</DialogDescription>}
        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
            <p className="text-sm text-muted-foreground">Obrigado por orar. {missionaryName} vai ver sua mensagem.</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              placeholder="Escreva uma oração de apoio e incentivo..."
              rows={4}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar oração
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
