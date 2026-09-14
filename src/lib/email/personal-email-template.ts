// Shell de e-mail "carta pessoal" — a pedido do usuário: e-mails de
// parceiro (lembrete, agradecimento) não devem parecer notificação do
// sistema (faixa colorida com wordmark "go→guide", ver wrapEmail()/
// renderEmailTemplate()), e sim como se o próprio missionário estivesse
// escrevendo. Card branco simples, sem cabeçalho de marca — a identidade
// vem do avatar+nome do missionário (quando há foto) e do próprio texto
// ("Oi, fulano! Aqui é ciclano."), não de um logo. A menção à plataforma
// fica só numa linha pequena no rodapé (mesmo espírito de "enviado via" que
// ferramentas de e-mail em massa já usam), pra continuar honesto sobre ser
// automático sem competir visualmente com a mensagem.
export function wrapPersonalEmail(opts: {
  missionaryName: string
  avatarUrl?: string | null
  bodyHtml: string
  footNoteHtml: string
  locale?: string
}): string {
  const { missionaryName, avatarUrl, bodyHtml, footNoteHtml, locale = 'pt' } = opts

  const avatarHtml = avatarUrl
    ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="width:48px;padding-right:12px;">
            <img src="${avatarUrl}" width="48" height="48" alt="${missionaryName}"
              style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;border:1px solid #e5e7eb;" />
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${missionaryName}</p>
          </td>
        </tr>
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="padding:40px 36px 8px;">
            ${avatarHtml}
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            <div style="border-top:1px solid #e5e7eb;margin:8px 0 16px;"></div>
            ${footNoteHtml}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
