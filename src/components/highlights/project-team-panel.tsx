'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { ProjectMemberRole } from '@/types/database'

interface Member { id: string; user_id: string; role: ProjectMemberRole }

interface Props {
  highlightId: string
  members: Member[]
}

const ROLE_LABEL: Record<ProjectMemberRole, string> = { lead: 'Líder', member: 'Membro', viewer: 'Observador' }

export function ProjectTeamPanel({ highlightId, members }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('member')
  const { isPending: saving, run: runAdd } = usePendingAction()
  const { pendingValue: removingId, run: runRemove } = usePendingAction<string>()

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    runAdd(true, async () => {
      const res = await fetch('/api/projects/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlightId, email: email.trim(), role }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Erro ao adicionar membro.')
        return
      }
      toast.success('Membro adicionado à equipe.')
      setEmail('')
      setOpen(false)
      router.refresh()
    })
  }

  function handleRemove(member: Member) {
    runRemove(member.id, async () => {
      const res = await fetch('/api/projects/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, highlightId, memberUserId: member.user_id }),
      })
      if (!res.ok) { toast.error('Erro ao remover membro.'); return }
      toast.success('Membro removido.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{members.length} membro(s) na equipe</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>} />
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Adicionar à equipe</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="pessoa@email.com" required />
                <p className="text-xs text-muted-foreground">A pessoa precisa já ter uma conta no go_guide.</p>
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                  <option value="lead">Líder (edita projeto + financeiro)</option>
                  <option value="member">Membro (vê financeiro, posta atualizações)</option>
                  <option value="viewer">Observador (só visualiza)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
            <p className="text-sm font-mono flex-1 min-w-0 truncate text-muted-foreground">{m.user_id}</p>
            <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge>
            <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(m)} disabled={removingId === m.id}>
              {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum membro ainda — apenas você.</p>}
      </div>
    </div>
  )
}
