'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PrayerRequestForm } from './prayer-request-form'

interface Props {
  profileId: string
  username: string
  missionaryName: string
  missionaryUserId: string
}

/** Versão em modal de `/[username]/oracao`, mesmo padrão do
 *  `PartnershipModal` (ver `partnership-modal.tsx`): montada via
 *  intercepting route (`@modal/(.)oracao`) quando o clique parte do perfil
 *  público, caixa centralizada de cantos arredondados. Diferente da
 *  parceria, este formulário não tem cabeçalho fixo próprio (a página cheia
 *  só tinha um `<h1>` normal), então o fechar aqui precisa de um X próprio
 *  em vez de reaproveitar um back button interno. */
export function PrayerModal({ profileId, username, missionaryName, missionaryUserId }: Props) {
  const router = useRouter()

  return (
    <Dialog open onOpenChange={(next) => { if (!next) router.back() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1.5rem)] max-h-[85vh] sm:max-w-md flex flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <DialogTitle className="sr-only">Orar por {missionaryName}</DialogTitle>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 text-foreground ring-1 ring-border hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-8">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Orar por {missionaryName}</h1>
              <p className="text-muted-foreground mt-2">Envie uma palavra de oração e incentivo para fortalecer essa missão.</p>
            </div>
            <PrayerRequestForm profileId={profileId} username={username} missionaryName={missionaryName} missionaryUserId={missionaryUserId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
