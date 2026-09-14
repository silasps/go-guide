interface SendEmailArgs {
  to: string
  toName: string
  subject: string
  html: string
  /** Nome de exibição do remetente (campo "De"), pros e-mails que soam como o
   *  próprio missionário escrevendo (lembrete de parceria, agradecimento de
   *  oferta etc.) — mostra "{missionário} via {appName}" em vez do nome fixo
   *  da plataforma, sem trocar o endereço de fato (continua saindo do domínio
   *  verificado). Omitido = nome padrão da plataforma (e-mails operacionais:
   *  verificação, alerta de Stripe, notificação de dashboard). */
  fromName?: string
}

// Chave ausente = desativado (mesmo padrão de getStripeClient() em src/lib/stripe/client.ts) —
// não lança erro, só não envia, até BREVO_API_KEY entrar em produção.
export async function sendEmail({ to, toName, subject, html, fromName }: SendEmailArgs): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    console.error('sendEmail: BREVO_API_KEY ou BREVO_FROM_EMAIL não configurados neste ambiente.')
    return false
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName ?? (process.env.NEXT_PUBLIC_APP_NAME ?? 'Missão') },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`sendEmail: Brevo respondeu ${res.status}: ${body}`)
  }

  return res.ok
}
