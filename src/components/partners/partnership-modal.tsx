'use client'

import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PartnershipWizard, type PartnershipWizardProps } from './partnership-wizard'

/** Versão em modal de `/[username]/parceria`, montada via intercepting route
 *  (`@modal/(.)parceria`) quando o clique parte do perfil público — o
 *  parceiro nunca tem a sensação de "sair" da página do missionário. Acesso
 *  direto (link compartilhado, retorno do Stripe, e-mail de lembrete)
 *  continua caindo na página cheia normal em `parceria/page.tsx`.
 *  O wizard em si não muda: o próprio BackButton dele já usa router.back()
 *  quando há navegação in-app, então fechar aqui é só "voltar" de novo.
 *
 *  Caixa centralizada com cantos arredondados, mesmo padrão do
 *  ProjectStoryDialog (não fullscreen tipo WizardModal) — cresce com a tela
 *  só via max-width/max-height por cima da centralização padrão do
 *  DialogContent (top/left/translate intocados, mesma lição documentada no
 *  Changelog do ProjectStoryDialog: mexer nisso quebra em mobile real).
 *  `CheckoutHeader`/rodapés fixos do wizard continuam `position: fixed`,
 *  mas passam a se ancorar nesta caixa em vez do viewport inteiro — todo
 *  ancestral com `transform` (o que o DialogContent já tem, mesmo com
 *  translate zerado) vira containing block dos descendentes fixed, então
 *  eles ficam presos ao topo/rodapé da caixa, não da tela, e são recortados
 *  pelos cantos arredondados dela (CSS padrão, sem JS). Quem rola é o `div`
 *  interno (`flex-1 min-h-0 overflow-y-auto`), não a caixa em si. */
export function PartnershipModal(props: PartnershipWizardProps) {
  const router = useRouter()

  return (
    <Dialog open onOpenChange={(next) => { if (!next) router.back() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1.5rem)] max-h-[85vh] sm:max-w-xl sm:max-h-[88vh] lg:max-w-2xl lg:max-h-[90vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <DialogTitle className="sr-only">Seja parceiro</DialogTitle>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <PartnershipWizard {...props} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
