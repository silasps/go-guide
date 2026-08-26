'use client'

interface Props {
  cardActive: boolean
  onSelectCard: () => void
  onSelectManual: () => void
  cardLabel: string
  manualLabel: string
}

// Segmented control (Cartão x Outro método), inspirado no mockup do Stitch —
// substitui o antigo par botão+link "prefiro cartão"/"prefiro manual".
export function PaymentModeTabs({ cardActive, onSelectCard, onSelectManual, cardLabel, manualLabel }: Props) {
  return (
    <div className="flex bg-muted p-1 rounded-lg">
      <button
        type="button"
        onClick={onSelectCard}
        className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
          cardActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {cardLabel}
      </button>
      <button
        type="button"
        onClick={onSelectManual}
        className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
          !cardActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {manualLabel}
      </button>
    </div>
  )
}
