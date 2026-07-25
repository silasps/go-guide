import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const now = new Date().toISOString()

  const { data: due } = await supabase
    .from('posts')
    .select('id')
    .eq('is_draft', false)
    .is('published_at', null)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now)

  let published = 0
  for (const post of due ?? []) {
    const { error } = await supabase.from('posts').update({ published_at: now }).eq('id', post.id)
    if (!error) published += 1
  }

  return NextResponse.json({ published })
}
