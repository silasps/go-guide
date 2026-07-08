'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Users, Trash2 } from 'lucide-react'

interface Member { id: string; user_id: string; role: string }

interface Props {
  accountId: string
  members: Member[]
}

export function ManageMembersDialog({ accountId, members }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const { isPending: saving, run: runAdd } = usePendingAction()
  const { pendingValue: removingId, run: runRemove } = usePendingAction<string>()

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    runAdd(true, async () => {
      const res = await fetch('/api/accounts/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, email: email.trim(), role: 'viewer' }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Erro ao adicionar membro.')
        return
      }
      toast.success('Membro adicionado.')
      setEmail('')
      router.refresh()
    })
  }

  function handleRemove(memberId: string) {
    runRemove(memberId, async () => {
      const res = await fetch('/api/accounts/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, accountId }),
      })
      if (!res.ok) { toast.error('Erro ao remover membro.'); return }
      toast.success('Membro removido.')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Membros ({members.length})</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Membros da conta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {members.length > 0 && (
            <ul className="space-y-1.5">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{m.role === 'owner' ? '👑 ' : ''}{m.user_id.slice(0, 8)}…</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(m.id)} disabled={removingId === m.id}>
                    {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAdd} className="space-y-2">
            <Label>Adicionar por e-mail</Label>
            <div className="flex gap-2">
              <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="pessoa@email.com" />
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">A pessoa precisa já ter uma conta no go_guide.</p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
