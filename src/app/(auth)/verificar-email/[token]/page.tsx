import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react'

type Props = { params: Promise<{ token: string }> }

export default async function VerificarEmailPage({ params }: Props) {
  const { token } = await params
  const t = await getTranslations('Auth')
  const supabase = await createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, email_verification_token_expires_at')
    .eq('email_verification_token', token)
    .maybeSingle()

  if (!profile) {
    return (
      <Result icon={XCircle} title={t('verifyEmailInvalidTitle')} description={t('verifyEmailInvalidBody')} />
    )
  }

  const expired = profile.email_verification_token_expires_at
    ? new Date(profile.email_verification_token_expires_at) < new Date()
    : true

  if (expired) {
    return (
      <Result icon={Clock} title={t('verifyEmailExpiredTitle')} description={t('verifyEmailExpiredBody')} />
    )
  }

  await supabase
    .from('profiles')
    .update({ email_verified: true, email_verification_token: null, email_verification_token_expires_at: null })
    .eq('user_id', profile.user_id)

  // Mantém auth.users.email_confirmed_at em sincronia — mesma info, caminho nativo do Supabase.
  await supabase.auth.admin.updateUserById(profile.user_id, { email_confirm: true })

  return (
    <Result icon={CheckCircle2} title={t('verifyEmailSuccessTitle')} description={t('verifyEmailSuccessBody')} success />
  )
}

async function Result({ icon: Icon, title, description, success }: {
  icon: LucideIcon
  title: string
  description: string
  success?: boolean
}) {
  const t = await getTranslations('Auth')
  return (
    <Card>
      <CardHeader className="text-center">
        <Icon className={`mx-auto mb-2 h-10 w-10 ${success ? 'text-primary' : 'text-muted-foreground'}`} />
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="justify-center">
        <Link
          href={success ? '/dashboard' : '/verificar-email/pendente'}
          className={cn(buttonVariants(), 'w-full')}
        >
          {success ? t('goToDashboard') : t('requestNewLink')}
        </Link>
      </CardFooter>
    </Card>
  )
}
