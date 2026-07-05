'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function ExcluirContaPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [confirmValue, setConfirmValue] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login?next=/conta/excluir')
      else setChecking(false)
    })
  }, [router])

  async function handleDelete() {
    if (confirmValue !== 'EXCLUIR') { toast.error('Digite EXCLUIR para confirmar.'); return }
    setDeleting(true)
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: confirmValue }),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Erro ao excluir conta. Se você tem perfil de missionário, use Configurações > Conta e digite seu @username.')
      setDeleting(false)
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Excluir minha conta permanentemente</CardTitle>
          <CardDescription>
            Isso apaga permanentemente todos os seus dados (mensagens, pedidos de oração, dados de parceria e/ou perfil de missionário) e não pode ser desfeito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Digite <span className="font-mono font-medium">EXCLUIR</span> para confirmar</Label>
            <Input value={confirmValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmValue(e.target.value)} placeholder="EXCLUIR" />
          </div>
          <Button variant="destructive" className="w-full" onClick={handleDelete} disabled={deleting || confirmValue !== 'EXCLUIR'}>
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir conta permanentemente
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
