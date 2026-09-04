// Template de e-mail transacional compartilhado — layout baseado em tabela
// (compatibilidade com Outlook/clientes antigos) com a identidade visual do
// app: logo real (`public/logo.png`), tipografia e cores convertidas de
// `globals.css` (oklch → hex, já que e-mail não entende oklch/CSS vars).
// Usado por `notification-emails` (ver system.architecture.md 7.10).

export type EmailAccent = 'primary' | 'success' | 'warning'

const ACCENTS: Record<EmailAccent, { bg: string; fg: string }> = {
  primary: { bg: '#34390c', fg: '#f4f7eb' }, // --primary
  success: { bg: '#1ea662', fg: '#f2fff6' }, // --success
  warning: { bg: '#f49f1e', fg: '#1c140c' }, // --warning
}

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

interface RenderEmailOptions {
  appUrl: string
  title: string
  bodyHtml: string
  accent?: EmailAccent
  cta?: { url: string; label: string }
  /** Texto de preview que alguns clientes mostram antes de abrir — não aparece no corpo. */
  preheader?: string
}

export function renderEmailTemplate({ appUrl, title, bodyHtml, accent = 'primary', cta, preheader }: RenderEmailOptions): string {
  const { bg, fg } = ACCENTS[accent]

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;border:1px solid #e5e5e5;">
            <tr>
              <td style="padding:4px;">
                <div style="height:4px;line-height:4px;border-radius:999px;background:${bg};font-size:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 4px;text-align:center;">
                <img src="${appUrl}/logo.png" width="112" alt="go→guide" style="display:block;margin:0 auto;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;font-family:${FONT_STACK};">
                <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:700;color:#0a0a0a;">${title}</h1>
                <div style="font-size:15px;line-height:1.65;color:#404040;">${bodyHtml}</div>
                ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;">
                  <tr>
                    <td style="border-radius:12px;background:${bg};">
                      <a href="${cta.url}" style="display:inline-block;padding:13px 28px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${fg};text-decoration:none;">${cta.label} →</a>
                    </td>
                  </tr>
                </table>` : ''}
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-family:${FONT_STACK};font-size:12px;color:#a3a3a3;">
            Enviado por <a href="${appUrl}" style="color:#a3a3a3;">go→guide</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
