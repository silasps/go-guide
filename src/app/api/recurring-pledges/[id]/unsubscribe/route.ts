import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()
  await supabase.from('recurring_pledges').update({ status: 'cancelled' }).eq('id', id)

  return new NextResponse(
    '<html><body style="font-family:sans-serif;text-align:center;padding:48px"><p>Lembrete cancelado. Você não vai mais receber esse e-mail mensal.</p></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
