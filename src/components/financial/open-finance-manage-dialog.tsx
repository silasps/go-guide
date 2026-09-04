'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatRelativeTime } from '@/lib/utils'
import { OpenFinanceItem } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Settings2, Plus, RefreshCw, Unlink, Loader2, Landmark } from 'lucide-react'

// O SDK da Pluggy escreve em `window` no momento do import (registro de
// versão) — quebra a passada de SSR do Next se importado no topo do
// arquivo. `ssr: false` garante que só carrega no cliente.
const PluggyConnect = dynamic(() => import('react-pluggy-connect').then((m) => m.PluggyConnect), { ssr: false })

const STATUS_LABEL: Record<string, { label: string; variant: 'secondary' | 'destructive' | 'outline' }> = {
  UPDATED: { label: 'Sincronizado', variant: 'secondary' },
  UPDATING: { label: 'Sincronizando…', variant: 'outline' },
  WAITING_USER_INPUT: { label: 'Aguardando confirmação', variant: 'outline' },
  LOGIN_ERROR: { label: 'Reconectar', variant: 'destructive' },
  OUTDATED: { label: 'Tentando de novo', variant: 'outline' },
}

interface Props {
  items: OpenFinanceItem[]
  isConfigured: boolean
}

export function OpenFinanceManageDialog({ items, isConfigured }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [updateItemId, setUpdateItemId] = useState<string | undefined>(undefined)
  const { isPending: launching, run: runLaunch } = usePendingAction()
  const { pendingValue: syncingId, run: runSync } = usePendingAction<string>()
  const { pendingValue: removingId, run: runRemove } = usePendingAction<string>()

  function launchConnect(reconnectItemId?: string) {
    runLaunch(true, async () => {
      const res = await fetch('/api/open-finance/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reconnectItemId ? { itemId: reconnectItemId } : {}),
      })
      if (!res.ok) {
        toast.error('Erro ao iniciar conexão com o banco.')
        return
      }
      const data = await res.json()
      setUpdateItemId(data.pluggyItemId ?? undefined)
      setConnectToken(data.accessToken)
      setOpen(false)
    })
  }

  async function handleConnectSuccess(data: { item: { id: string } }) {
    setConnectToken(null)
    const res = await fetch('/api/open-finance/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluggyItemId: data.item.id }),
    })
    setOpen(true)
    if (!res.ok) {
      toast.error('Conexão feita, mas houve erro ao importar as contas. Tente sincronizar de novo.')
      router.refresh()
      return
    }
    toast.success('Banco conectado! Importando contas e lançamentos…')
    router.refresh()
  }

  function sync(itemId: string) {
    runSync(itemId, async () => {
      const res = await fetch(`/api/open-finance/items/${itemId}/sync`, { method: 'POST' })
      if (!res.ok) { toast.error('Erro ao sincronizar.'); return }
      toast.success('Sincronizado.')
      router.refresh()
    })
  }

  function remove(itemId: string, connectorName: string) {
    if (!confirm(`Desconectar "${connectorName}"? As contas e os lançamentos já importados continuam, mas param de sincronizar.`)) return
    runRemove(itemId, async () => {
      const res = await fetch(`/api/open-finance/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erro ao desconectar.'); return }
      toast.success('Banco desconectado.')
      router.refresh()
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={
          <Button variant="outline" className="gap-2">
            <Settings2 className="h-4 w-4" /> Gerenciar Open Finance
          </Button>
        } />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Finance</DialogTitle>
            <DialogDescription>Conecte seus bancos para importar contas e lançamentos automaticamente.</DialogDescription>
          </DialogHeader>

          {!isConfigured ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Integração ainda não configurada. Defina <code className="text-xs">PLUGGY_CLIENT_ID</code> e{' '}
              <code className="text-xs">PLUGGY_CLIENT_SECRET</code> nas variáveis de ambiente para habilitar a conexão bancária.
            </p>
          ) : (
            <div className="space-y-4">
              {items.length > 0 && (
                <ul className="space-y-2">
                  {items.map((item) => {
                    const status = STATUS_LABEL[item.status] ?? { label: item.status, variant: 'outline' as const }
                    return (
                      <li key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={item.connector_image_url ?? ''} alt={item.connector_name} />
                          <AvatarFallback><Landmark className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.connector_name}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                            {item.last_synced_at && (
                              <span className="text-xs text-muted-foreground">Sincronizado {formatRelativeTime(item.last_synced_at)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {item.status === 'LOGIN_ERROR' ? (
                            <Button size="sm" variant="secondary" disabled={launching} onClick={() => launchConnect(item.id)}>
                              Reconectar
                            </Button>
                          ) : (
                            <Button size="icon-sm" variant="ghost" disabled={syncingId === item.id} title="Sincronizar agora" onClick={() => sync(item.id)}>
                              {syncingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button size="icon-sm" variant="ghost" disabled={removingId === item.id} title="Desconectar" onClick={() => remove(item.id, item.connector_name)}>
                            {removingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <Button type="button" variant="outline" className="w-full gap-1.5" disabled={launching} onClick={() => launchConnect()}>
                {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Conectar novo banco
              </Button>
            </div>
          )}

          <DialogFooter className="sm:justify-start">
            <p className="text-xs text-muted-foreground">Conexão via Pluggy, agregador certificado de Open Finance.</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox
          updateItem={updateItemId}
          onSuccess={handleConnectSuccess}
          onError={() => { setConnectToken(null); setOpen(true); toast.error('Erro na conexão com o banco.') }}
          onClose={() => { setConnectToken(null); setOpen(true) }}
        />
      )}
    </>
  )
}
