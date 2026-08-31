import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()
  await supabase.from('partners').update({ update_emails_opt_in: false }).eq('id', id)

  return new NextResponse(
    '<html><body style="font-family:sans-serif;text-align:center;padding:48px"><p>Combinado — você não vai mais receber e-mails de atualização. Obrigado por ter orado! 🙏</p></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
