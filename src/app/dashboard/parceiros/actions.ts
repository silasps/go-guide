'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { BroadcastRecipientFilter, FinancialVisibility } from '@/types/database'

interface CreateBroadcastResult {
  recipientCount: number
  shareUrl: string
}

// Fase 1 de "campanhas pra parceiros" (system.architecture.md 7.10-bis):
// monta a lista de destinatários no momento do envio (não guarda uma lista
// congelada) e enfileira 1 linha por parceiro em partner_broadcast_
// recipients — o cron broadcast-sender (a cada 5min) drena de fato.
// `sendByEmail=false` só cria o registro (e a landing page pública que ele
// gera) sem enfileirar nenhum e-mail — pra quando o missionário quer só o
// link pra mandar por WhatsApp, sem disparar pra rede de parceiros.
// "Gerar link" e "mandar e-mail" são decisões independentes.
export async function createBroadcast(
  subject: string,
  body: string,
  recipientFilter: BroadcastRecipientFilter,
  highlightIds: string[] = [],
  financialSnapshot: unknown = null,
  sendByEmail: boolean = true,
  financialVisibility: FinancialVisibility = 'exact'
): Promise<CreateBroadcastResult> {
  const trimmedSubject = subject.trim()
  const trimmedBody = body.trim()
  if (!trimmedSubject || !trimmedBody) throw new Error('Assunto e mensagem são obrigatórios.')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const profile = await getActiveProfile()
  if (!profile) throw new Error('Perfil não encontrado.')

  let partners: { id: string; email: string | null }[] = []
  if (sendByEmail) {
    let query = supabase
      .from('partners')
      .select('id, email')
      .eq('profile_id', profile.id)
      .not('email', 'is', null)
      .eq('update_emails_opt_in', true)

    if (recipientFilter !== 'all') query = query.eq('type', recipientFilter)

    const { data, error: partnersError } = await query
    if (partnersError) throw partnersError
    partners = data ?? []
  }

  const { data: broadcast, error: insertError } = await supabase
    .from('partner_broadcasts')
    .insert({
      profile_id: profile.id,
      sender_user_id: user.id,
      subject: trimmedSubject,
      body: trimmedBody,
      recipient_filter: recipientFilter,
      recipient_count: partners.length,
      highlight_ids: highlightIds,
      financial_snapshot: financialSnapshot,
      financial_visibility: financialVisibility,
    })
    .select('id')
    .single()
  if (insertError) throw insertError

  if (partners.length > 0) {
    const rows = partners.map((p) => ({ broadcast_id: broadcast.id, partner_id: p.id, email: p.email as string }))
    const { error: recipientsError } = await supabase.from('partner_broadcast_recipients').insert(rows)
    if (recipientsError) throw recipientsError
  }

  revalidatePath('/dashboard/parceiros')
  revalidatePath('/dashboard/financeiro/prestacoes')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return { recipientCount: partners.length, shareUrl: `${appUrl}/${profile.username}/atualizacoes/${broadcast.id}` }
}
