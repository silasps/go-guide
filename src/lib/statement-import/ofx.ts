export interface ParsedStatementTransaction {
  uid: string
  date: string
  amount: number
  type: 'income' | 'expense'
  description: string
}

// Bancos brasileiros costumam exportar OFX em Windows-1252/ISO-8859-1, não
// UTF-8 (herança do padrão OFX 1.x, SGML). O cabeçalho (sempre ASCII puro,
// mesmo quando o corpo não é) declara o charset real em `CHARSET:` — lemos
// só esse trecho pra decidir a codificação antes de decodificar o arquivo
// inteiro, em vez de assumir UTF-8 e quebrar acentos.
export async function readOfxFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const head = new TextDecoder('ascii').decode(buffer.slice(0, 1024))
  const charset = head.match(/CHARSET:\s*(\S+)/i)?.[1]?.toUpperCase()
  const encoding = charset === '1252' ? 'windows-1252' : charset?.includes('8859') ? 'iso-8859-1' : 'utf-8'
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(buffer)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  }
}

function tagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return match ? match[1].trim() : null
}

// Parser tolerante o bastante pros dois formatos de OFX em circulação: 1.x
// (SGML, tags sem fechamento, uma por linha) e 2.x (XML bem formado) — como
// só extraímos os campos por regex dentro de cada bloco `<STMTTRN>`, a
// presença ou não de `</TAG>` não importa.
export function parseOfx(text: string): ParsedStatementTransaction[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  const results: ParsedStatementTransaction[] = []

  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>|<STMTTRN>/i)[0]
    const dtposted = tagValue(block, 'DTPOSTED')
    const trnamtRaw = tagValue(block, 'TRNAMT')
    if (!dtposted || dtposted.length < 8 || !trnamtRaw) continue

    const amount = parseFloat(trnamtRaw.replace(',', '.'))
    if (Number.isNaN(amount) || amount === 0) continue

    const fitId = tagValue(block, 'FITID')
    const name = tagValue(block, 'NAME') ?? tagValue(block, 'PAYEE')
    const memo = tagValue(block, 'MEMO')
    const description = (name || memo || 'Lançamento importado').trim()

    results.push({
      uid: fitId || `${dtposted}-${trnamtRaw}-${description.slice(0, 24)}`,
      date: `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`,
      amount: Math.abs(amount),
      type: amount >= 0 ? 'income' : 'expense',
      description,
    })
  }

  return results
}
