import { formatCurrency } from '@/lib/utils'

const BRAND_COLOR = '#34390c'

export interface BroadcastProjectCard {
  title: string
  slug: string | null
  coverUrl: string | null
  goalAmount: number | null
  currentAmount: number
  currency: string
}

// Cartão de projeto no e-mail de atualização — montado por código, nunca
// pela IA (a IA só escreve a narrativa em texto; imagem/link/progresso
// aqui vêm direto do banco, sempre corretos). system.architecture.md 7.10-bis.
function projectCardHtml(p: BroadcastProjectCard, appUrl: string, username: string): string {
  const pct = p.goalAmount ? Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100)) : null
  const remaining = p.goalAmount ? Math.max(0, p.goalAmount - p.currentAmount) : null
  const link = p.slug ? `${appUrl}/${username}/projetos/${p.slug}` : `${appUrl}/${username}`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      ${p.coverUrl ? `<tr><td><img src="${p.coverUrl}" alt="${p.title}" width="100%" style="display:block;width:100%;height:160px;object-fit:cover;" /></td></tr>` : ''}
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111827;">${p.title}</p>
          ${pct !== null ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr><td style="background:#e5e7eb;border-radius:999px;height:8px;">
                <div style="background:${BRAND_COLOR};border-radius:999px;height:8px;width:${pct}%;"></div>
              </td></tr>
            </table>
            <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">
              ${formatCurrency(p.currentAmount, p.currency)} de ${formatCurrency(p.goalAmount as number, p.currency)} (${pct}%)${remaining && remaining > 0 ? ` — faltam ${formatCurrency(remaining, p.currency)}` : ''}
            </p>
          ` : ''}
          <a href="${link}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;">Ver projeto e contribuir →</a>
        </td>
      </tr>
    </table>
  `
}

export function buildBroadcastHtml({
  narrativeBody,
  projects,
  appUrl,
  username,
  unsubscribeUrl,
}: {
  narrativeBody: string
  projects: BroadcastProjectCard[]
  appUrl: string
  username: string
  unsubscribeUrl: string
}): string {
  return `
    <div>${narrativeBody.replace(/\n/g, '<br/>')}</div>
    ${projects.map((p) => projectCardHtml(p, appUrl, username)).join('')}
    <p style="color:#888;font-size:12px;margin-top:24px;">
      Não quer mais receber esses e-mails? <a href="${unsubscribeUrl}">Cancelar e-mails de atualização</a>.
    </p>
  `
}
