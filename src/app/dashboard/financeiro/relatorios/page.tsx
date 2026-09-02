import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { PartnerUpdateFinancial } from '@/lib/ai/generate-partner-update'
import { Badge } from '@/components/ui/badge'
import { ShareButton } from '@/components/shared/share-button'
import { SendBroadcastButton } from '@/components/partners/send-broadcast-button'
import { Card, CardContent } from '@/components/ui/card'
import { planLimits } from '@/lib/utils'
import { FileText } from 'lucide-react'

// Histórico de prestações de contas já publicadas (system.architecture.md
// 7.10-bis/7.10-quater) — cada uma é uma `partner_broadcasts` com
// `financial_snapshot` preenchido. Não existia lugar nenhum pra listar isso
// antes: a única forma de acessar uma prestação de contas antiga era o
// missionário ter guardado o link mostrado na hora do envio. A composição
// em si continua em /dashboard/parceiros (SendBroadcastButton) — esta aba
// só lista o que já foi publicado e reaproveita o link público de cada uma.
export default async function RelatoriosPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: reports } = await supabase
    .from('partner_broadcasts')
    .select('id, subject, created_at, financial_snapshot, financial_visibility')
    .eq('profile_id', profile!.id)
    .not('financial_snapshot', 'is', null)
    .order('created_at', { ascending: false })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const aiConfigured = !!process.env.ANTHROPIC_API_KEY
  const aiPlanIncluded = planLimits(profile!.plan).aiCreditsIncluded > 0

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">Nenhuma prestação de contas publicada ainda.</p>
          <SendBroadcastButton profileId={profile!.id} mode="report" aiConfigured={aiConfigured} aiPlanIncluded={aiPlanIncluded} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{reports.length} prestação(ões) de contas publicada(s)</p>
        <SendBroadcastButton profileId={profile!.id} mode="report" aiConfigured={aiConfigured} aiPlanIncluded={aiPlanIncluded} />
      </div>

      <div className="space-y-2.5">
        {reports.map((r) => {
          const financial = r.financial_snapshot as PartnerUpdateFinancial | null
          const shareUrl = `${appUrl}/${profile!.username}/atualizacoes/${r.id}`
          const dateLabel = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

          return (
            <div key={r.id} className="rounded-xl border bg-card p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{dateLabel} {financial?.periodLabel ? `· período: ${financial.periodLabel}` : ''}</p>
                </div>
                <Badge variant={r.financial_visibility === 'exact' ? 'secondary' : 'success'} className="shrink-0">
                  {r.financial_visibility === 'exact' ? 'Valores exatos' : 'Só percentuais'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
                  Ver página pública
                </a>
                <ShareButton url={shareUrl} title={r.subject} label="Copiar link" copiedLabel="Link copiado!" variant="outline" iconOnly />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
