// #34390c = --primary do app (verde-oliva "Colheita") — mesma cor de marca
// usada em botões e destaques em toda a UI. Hoje também duplicada como
// const local em send-verification-email.ts e inline em
// notification-emails/route.ts; centralizando aqui pra não criar uma
// terceira cópia, sem reescrever essas duas por enquanto.
export const BRAND_COLOR = '#34390c'

/** Shell padrão de e-mail transacional: capa colorida com o nome da
 *  plataforma centralizado (texto, sem logo por ora) + título, corpo em
 *  card branco arredondado. Mesma estrutura de tabela de
 *  send-verification-email.ts (a única letterhead que já existia), só
 *  troca a imagem do logo por um wordmark em texto — um cabeçalho sozinho
 *  não resolveria o problema de a maioria dos e-mails não ter moldura
 *  nenhuma hoje, então isso monta o card inteiro, não só a faixa do topo. */
export function wrapEmail(bodyHtml: string, title: string): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'go→guide'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${BRAND_COLOR};padding:28px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);">${appName}</p>
            <h1 style="margin:0;font-size:20px;font-weight:800;color:#ffffff;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            ${bodyHtml}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
