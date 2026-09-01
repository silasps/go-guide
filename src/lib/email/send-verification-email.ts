import { sendEmail } from './brevo'

// #34390c = --primary do app (verde-oliva "Colheita", ver globals.css e
// system.architecture.md seção 11) — mesma cor de marca usada em botões e
// destaques em toda a UI, pra o e-mail não parecer de um produto diferente.
const BRAND_COLOR = '#34390c'

export async function sendVerificationEmail(to: string, toName: string, verifyUrl: string): Promise<boolean> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'go→guide'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${BRAND_COLOR};padding:32px 40px;text-align:center;">
            <img src="${appUrl}/logo-white.png" alt="${appName}" height="28" style="height:28px;width:auto;margin-bottom:16px;" />
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Confirme seu e-mail</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Olá${toName ? `, ${toName}` : ''}! Confirme seu e-mail para ativar sua conta no ${appName}.
              Clique no botão abaixo para verificar.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${verifyUrl}"
                    style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">
                    Confirmar meu e-mail →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
              Este link expira em <strong>24 horas</strong>. Se você não criou essa conta, ignore este e-mail.
            </p>
            <p style="margin:0;font-size:12px;color:#d1d5db;word-break:break-all;">
              ${verifyUrl}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return sendEmail({ to, toName, subject: 'Confirme seu e-mail', html })
}
