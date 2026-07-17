interface SendEmailArgs {
  to: string
  toName: string
  subject: string
  html: string
}

// Chave ausente = desativado (mesmo padrão de getStripeClient() em src/lib/stripe/client.ts) —
// não lança erro, só não envia, até BREVO_API_KEY entrar em produção.
export async function sendEmail({ to, toName, subject, html }: SendEmailArgs): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL
  if (!apiKey || !fromEmail) return false

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Missão' },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  })

  return res.ok
}
