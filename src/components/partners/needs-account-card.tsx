'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckoutHeader } from './checkout-header'

interface Props {
  backHref: string
  redirectParam: string
  title: string
  description: string
  createAccountLabel: string
  alreadyHaveAccountLabel: string
}

/** Tela cheia "crie sua conta pra continuar" — mesmo card usado em qualquer
 *  fluxo que precise de uma conta pra funcionar (parceria recorrente,
 *  oferta agendada): sem conta não dá pra lembrar/gerenciar depois. */
export function NeedsAccountCard({ backHref, redirectParam, title, description, createAccountLabel, alreadyHaveAccountLabel }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <CheckoutHeader backHref={backHref} />
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col justify-center px-4 pb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{description}</p>
            <Link href={`/cadastro?redirect=${redirectParam}`}>
              <Button className="w-full">{createAccountLabel}</Button>
            </Link>
            <Link href={`/login?redirect=${redirectParam}`}>
              <Button variant="outline" className="w-full">{alreadyHaveAccountLabel}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
