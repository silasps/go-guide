import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'

interface Row {
  missionary: string
  date: string
  amount: number
  currency: string
  method: string
}

function toCsv(rows: Row[], total: number): string {
  const header = 'Missionario/Instituicao,Data,Valor,Moeda,Metodo'
  const lines = rows.map((r) =>
    [r.missionary, r.date, r.amount.toFixed(2), r.currency, r.method].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  )
  return [header, ...lines, `"Total","","${total.toFixed(2)}","",""`].join('\n')
}

async function toPdf(rows: Row[], total: number, year: number, donorName: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  doc.fontSize(16).text(`Comprovante de doações — ${year}`, { align: 'left' })
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#666').text(donorName)
  doc.moveDown(1)

  doc.fontSize(10).fillColor('#000')
  for (const r of rows) {
    doc.text(`${r.date}  ·  ${r.missionary}  ·  ${r.method}`, { continued: false })
    doc.text(`${r.currency} ${r.amount.toFixed(2)}`, { align: 'right' })
    doc.moveDown(0.4)
  }

  doc.moveDown(0.6)
  doc.fontSize(12).text(`Total: ${rows[0]?.currency ?? ''} ${total.toFixed(2)}`, { align: 'right' })

  doc.moveDown(1.5)
  doc.fontSize(8).fillColor('#888').text(
    'Este documento é uma exportação agregada das doações registradas na plataforma e não constitui recibo fiscal oficial. Consulte um contador para sua declaração de imposto de renda.'
  )

  doc.end()
  return done
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv'
  if (!year || isNaN(year)) return NextResponse.json({ error: 'invalid_year' }, { status: 400 })

  const { data: pledges } = await supabase
    .from('pledges')
    .select('reported_amount, currency, reported_at, payment_method, profile:profiles(display_name)')
    .eq('reporter_user_id', user.id)
    .eq('status', 'confirmed')
    .gte('reported_at', `${year}-01-01`)
    .lte('reported_at', `${year}-12-31`)
    .order('reported_at', { ascending: true })

  const rows: Row[] = (pledges ?? []).map((p) => ({
    missionary: (p.profile as unknown as { display_name: string } | null)?.display_name ?? '—',
    date: new Date(p.reported_at).toLocaleDateString('pt-BR'),
    amount: p.reported_amount,
    currency: p.currency,
    method: p.payment_method,
  }))
  const total = rows.reduce((sum, r) => sum + r.amount, 0)

  if (format === 'csv') {
    return new NextResponse(toCsv(rows, total), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="doacoes-${year}.csv"`,
      },
    })
  }

  const donorName = user.user_metadata?.full_name ?? user.email ?? ''
  const pdfBuffer = await toPdf(rows, total, year, donorName)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doacoes-${year}.pdf"`,
    },
  })
}
