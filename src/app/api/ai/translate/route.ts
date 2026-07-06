import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AI_ACTION_COSTS } from '@/lib/ai/costs'
import { translateContent } from '@/lib/ai/translate'
import { LOCALES, type Locale } from '@/i18n/config'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const body = await req.json()
  const { profileId, sourceLocale, targetLocales, text } = body as {
    profileId: string
    sourceLocale: Locale
    targetLocales: Locale[]
    text: string
  }

  if (!profileId || !text?.trim()) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const validLocales = (l: unknown) => typeof l === 'string' && (LOCALES as readonly string[]).includes(l)
  if (!validLocales(sourceLocale) || !Array.isArray(targetLocales) || targetLocales.length === 0 || !targetLocales.every(validLocales) || targetLocales.includes(sourceLocale)) {
    return NextResponse.json({ error: 'invalid_locales' }, { status: 400 })
  }

  const { data: newBalance, error: creditError } = await supabase.rpc('consume_ai_credits', {
    p_profile_id: profileId,
    p_amount: AI_ACTION_COSTS.translate_content,
    p_reason: 'translate_content',
  })

  if (creditError) {
    const status = creditError.message.includes('insufficient_ai_credits') ? 402 : 403
    return NextResponse.json({ error: creditError.message }, { status })
  }

  try {
    const translations = await translateContent({ text, sourceLocale, targetLocales })
    return NextResponse.json({ translations, remainingCredits: newBalance })
  } catch {
    return NextResponse.json({ error: 'ai_provider_error' }, { status: 502 })
  }
}
