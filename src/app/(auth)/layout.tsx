import { CheckoutHeader } from '@/components/partners/checkout-header'

// Mesmo padrão de "top app bar" fixo já usado em toda a jornada de
// /parceria (CheckoutHeader + BackButton) — antes cada tela de auth tinha
// seu próprio back button solto (texto + seta, sem alinhamento fixo) e o
// logo ficava acima do card, então o cabeçalho "pulava de lugar" entre uma
// tela e outra (reportado pelo usuário com screenshots). `backHref="/"` é
// só a rede de segurança do BackButton — o clique normal volta pra tela
// anterior de verdade quando há histórico dentro do app.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <CheckoutHeader backHref="/" />
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col justify-center px-4 py-8">
        {children}
      </div>
    </div>
  )
}
