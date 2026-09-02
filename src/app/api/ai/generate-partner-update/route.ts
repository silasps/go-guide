import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AI_ACTION_COSTS } from '@/lib/ai/costs'
import { generatePartnerUpdate, PartnerUpdateFinancial, PartnerUpdateProject, FinancialVisibility } from '@/lib/ai/generate-partner-update'
import { generateTemplateUpdate } from '@/lib/partners/generate-template-update'

interface RequestBody {
  profileId: string
  draftText: string
  financialPeriod: { from: string; to: string; label: string } | null
  financialVisibility?: FinancialVisibility
  highlightIds: string[]
  /** 'ai' (default) chama Claude e gasta 1 crédito de IA. 'template' monta o
   *  texto por regras (src/lib/partners/generate-template-update.ts), sem
   *  IA nenhuma — não gasta crédito, não exige plano. Os dois dividem a
   *  mesma busca de transactions/highlights abaixo. */
  mode?: 'ai' | 'template'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const { profileId, draftText, financialPeriod, financialVisibility, highlightIds, mode = 'ai' } = (await req.json()) as RequestBody
  if (!profileId) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  let newBalance: number | null = null
  if (mode === 'ai') {
    const { data, error: creditError } = await supabase.rpc('consume_ai_credits', {
      p_profile_id: profileId,
      p_amount: AI_ACTION_COSTS.generate_partner_update,
      p_reason: 'generate_partner_update',
    })
    if (creditError) {
      const status = creditError.message.includes('insufficient_ai_credits') ? 402 : 403
      return NextResponse.json({ error: creditError.message }, { status })
    }
    newBalance = data
  }

  let financial: PartnerUpdateFinancial | null = null
  if (financialPeriod) {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('type, amount, currency, category_id, transaction_categories(name)')
      .eq('profile_id', profileId)
      .in('type', ['income', 'expense'])
      .gte('date', financialPeriod.from)
      .lte('date', financialPeriod.to)

    const incomeByCurrency: Record<string, number> = {}
    const expenseByCurrency: Record<string, number> = {}
    const expenseByCategory = new Map<string, { name: string; amount: number; currency: string }>()

    for (const t of transactions ?? []) {
      const target = t.type === 'income' ? incomeByCurrency : expenseByCurrency
      target[t.currency] = (target[t.currency] ?? 0) + Number(t.amount)

      if (t.type === 'expense' && t.category_id) {
        const category = Array.isArray(t.transaction_categories) ? t.transaction_categories[0] : t.transaction_categories
        const name = category?.name ?? 'Outros'
        const key = `${name}:${t.currency}`
        const existing = expenseByCategory.get(key)
        expenseByCategory.set(key, { name, currency: t.currency, amount: (existing?.amount ?? 0) + Number(t.amount) })
      }
    }

    financial = {
      periodLabel: financialPeriod.label,
      incomeByCurrency,
      expenseByCurrency,
      topExpenseCategories: [...expenseByCategory.values()].sort((a, b) => b.amount - a.amount).slice(0, 3),
    }
  }

  let projects: PartnerUpdateProject[] = []
  if (highlightIds?.length) {
    const { data: highlights } = await supabase
      .from('highlights')
      .select('title, goal_amount, current_amount, currency, funding_deadline')
      .eq('profile_id', profileId)
      .in('id', highlightIds)

    projects = (highlights ?? []).map((h) => ({
      title: h.title,
      goalAmount: h.goal_amount,
      currentAmount: h.current_amount,
      currency: h.currency ?? 'BRL',
      fundingDeadline: h.funding_deadline,
    }))
  }

  try {
    const body = mode === 'template'
      ? generateTemplateUpdate({ draftText: draftText ?? '', financial, financialVisibility, projects })
      : await generatePartnerUpdate({ draftText: draftText ?? '', financial, financialVisibility, projects })
    return NextResponse.json({ body, financial, remainingCredits: newBalance })
  } catch {
    return NextResponse.json({ error: 'ai_provider_error' }, { status: 502 })
  }
}
