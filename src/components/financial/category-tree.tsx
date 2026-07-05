'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TransactionCategory } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface Props {
  profileId: string
  categories: TransactionCategory[]
}

export function CategoryTree({ profileId, categories }: Props) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [newSubName, setNewSubName] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const top = categories.filter(c => !c.parent_id)
  const childrenOf = (id: string) => categories.filter(c => c.parent_id === id)

  async function addCategory(name: string, parentId: string | null) {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('transaction_categories').insert({ profile_id: profileId, name: name.trim(), parent_id: parentId })
    setSaving(false)
    if (error) { toast.error('Erro ao criar categoria.'); return }
    setNewName('')
    setNewSubName(prev => parentId ? { ...prev, [parentId]: '' } : prev)
    router.refresh()
  }

  async function removeCategory(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('transaction_categories').delete().eq('id', id)
    setDeletingId(null)
    if (error) { toast.error('Erro ao excluir categoria.'); return }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} placeholder="Nova categoria (ex: Transporte)" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(newName, null) } }} />
        <Button type="button" onClick={() => addCategory(newName, null)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-3">
        {top.map(cat => (
          <div key={cat.id} className="rounded-xl border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{cat.name}</p>
              <Button variant="ghost" size="icon-sm" onClick={() => removeCategory(cat.id)} disabled={deletingId === cat.id}>
                {deletingId === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {childrenOf(cat.id).length > 0 && (
              <ul className="pl-3 space-y-1 border-l">
                {childrenOf(cat.id).map(sub => (
                  <li key={sub.id} className="flex items-center justify-between text-sm text-muted-foreground">
                    {sub.name}
                    <Button variant="ghost" size="icon-sm" onClick={() => removeCategory(sub.id)} disabled={deletingId === sub.id}>
                      {deletingId === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pl-3">
              <Input
                value={newSubName[cat.id] ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSubName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                placeholder="Nova subcategoria"
                className="h-7 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(newSubName[cat.id] ?? '', cat.id) } }}
              />
              <Button type="button" variant="outline" size="icon-sm" onClick={() => addCategory(newSubName[cat.id] ?? '', cat.id)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {top.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma categoria ainda.</p>}
      </div>
    </div>
  )
}
