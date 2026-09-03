'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import * as keyManager from '@/lib/crypto/key-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

function CadastroForm() {
  const t = useTranslations('Auth')
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/onboarding'
  // Quem chega aqui vindo do fluxo de "apoiar um missionário" pula o
  // /onboarding (volta direto pro redirect) e nunca vê a pergunta explícita
  // de papel — sem essa nota, a pessoa não percebe que está criando uma
  // conta de apoiador (feedback direto do usuário).
  const isPartnerFlow = !redirect.startsWith('/onboarding')
  const isMessageFlow = redirect.includes('/mensagens')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error(t('passwordTooShort'))
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, phone: phone.trim() || undefined, birth_date: birthDate || undefined } },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await keyManager.setupOrUnlockWithPassword(data.user.id, password).catch(() => {})
    }

    // keepalive: o window.location.href logo abaixo derruba a página antes
    // que um fetch normal em segundo plano tivesse tempo de completar.
    fetch('/api/auth/enviar-verificacao', { method: 'POST', keepalive: true }).catch(() => {})

    toast.success(t('signupSuccess'))
    // Load completo, não router.push — mesmo motivo do /login: destino pode
    // estar fora da árvore de rotas já carregada no cliente.
    window.location.href = redirect
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        // Escopo extra pra tentar puxar a data de nascimento do Google (ver
        // /auth/callback, que busca via People API só quando esse escopo foi
        // concedido) — o usuário ainda pode negar essa permissão no
        // consentimento, então birth_date continua opcional.
        scopes: 'https://www.googleapis.com/auth/user.birthday.read',
      },
    })
  }

  return (
    <>
      <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('signupTitle')}</CardTitle>
        <CardDescription>{isMessageFlow ? t('signupSubtitleMessage') : t('signupSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        {isPartnerFlow && (
          <p className="mb-4 rounded-xl border border-support/30 bg-support/10 px-3 py-2.5 text-sm text-support">
            {t('signupPartnerNote')}
          </p>
        )}
        <Button variant="outline" className="w-full mb-4" onClick={handleGoogle}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {t('continueGoogle')}
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t('or')}</span>
          </div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('fullName')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('fullNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              {t('phoneLabel')} <span className="text-muted-foreground font-normal">{t('phoneOptional')}</span>
            </Label>
            <PhoneInput defaultValue={phone} onChange={setPhone} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">
              {t('birthDateLabel')} <span className="text-muted-foreground font-normal">{t('phoneOptional')}</span>
            </Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              autoComplete="bday"
              max={new Date().toISOString().slice(0, 10)}
            />
            <p className="text-xs text-muted-foreground">{t('birthDateHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('signupSubmit')}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="text-primary hover:underline font-medium">
            {t('login')}
          </Link>
        </p>
      </CardFooter>
      </Card>
    </>
  )
}

export default function CadastroPage() {
  const t = useTranslations('Auth')
  return (
    <Suspense fallback={<div className="h-96 flex items-center justify-center text-muted-foreground text-sm">{t('loading')}</div>}>
      <CadastroForm />
    </Suspense>
  )
}
