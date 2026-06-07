'use client'

import { useState } from 'react'
import { Partner } from '@/types/database'
import { formatDate, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, Search } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { financial: 'Financeiro', prayer: 'Oração', both: 'Ambos' }
const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  financial: 'default',
  prayer: 'secondary',
  both: 'outline',
}

export function PartnersList({ partners: initial }: { partners: Partner[] }) {
  const [partners, setPartners] = useState(initial)
  const [search, setSearch] = useState('')

  const filtered = partners.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover ${name} da lista de parceiros?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('partners').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover.'); return }
    setPartners(prev => prev.filter(p => p.id !== id))
    toast.success('Parceiro removido.')
  }

  if (!partners.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Nenhum parceiro cadastrado ainda.</p>
        <p className="text-sm mt-1">Adicione manualmente ou compartilhe o link de parceria do seu perfil.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar parceiro..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 border rounded-xl bg-card">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs">{getInitials(p.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">{p.email ?? p.phone ?? 'Sem contato'}</p>
            </div>
            <Badge variant={TYPE_VARIANT[p.type]} className="text-xs shrink-0">{TYPE_LABEL[p.type]}</Badge>
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{formatDate(p.joined_at)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => handleDelete(p.id, p.name)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
