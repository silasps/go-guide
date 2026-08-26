'use client'

import { BackButton } from '@/components/ui/back-button'
import { LanguageSwitcher } from '@/components/marketing/language-switcher'

interface Props {
  title?: string
  onBack?: () => void
  backHref?: string
  backLabel?: string
}

// Cabeçalho fixo compartilhado por toda a jornada de /parceria (lista
// inicial, oração/embaixador/voluntário, doação avulsa, recorrente) — sem
// isso, cada tela tinha seu próprio header dentro de um bloco centralizado
// verticalmente, então ele "descia" junto com o conteúdo em vez de ficar
// fixo no topo (padrão "top app bar" do Material Design: o cabeçalho fica
// fixo, o conteúdo é que começa logo abaixo dele, nunca o contrário).
export function CheckoutHeader({ title, onBack, backHref, backLabel = 'Voltar' }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-2">
        <BackButton onClick={onBack} href={backHref} label={backLabel} />
        {title && <h1 className="flex-1 font-semibold text-base truncate">{title}</h1>}
        <LanguageSwitcher compact className={title ? undefined : 'ml-auto'} />
      </div>
    </header>
  )
}
