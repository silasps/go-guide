'use client'

interface Props {
  amountFormatted: string
  label: string
}

// Resumo curto e sempre visível (valor + "para quem") — reforça o contexto
// do projeto/missionário conforme o apoiador preenche o formulário, ideia
// puxada do mockup do Stitch sem precisar de um wizard multi-página.
export function DonationSummary({ amountFormatted, label }: Props) {
  if (!amountFormatted) return null
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
      <p className="text-lg font-semibold text-primary">{amountFormatted}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
