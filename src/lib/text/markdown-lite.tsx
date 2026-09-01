import type { ReactNode } from 'react'

export interface MarkdownLiteBlock {
  type: 'heading' | 'paragraph'
  level: number
  content: string
}

// Suporte mínimo, sem lib externa: só o que aparece de fato nos textos de
// história/carta — "## "/"### " como cabeçalho e "**negrito**" inline.
// Parágrafos separados por linha em branco (\n\n), igual markdown de verdade,
// pra virar parágrafos reais em vez de um texto corrido só.
export function parseMarkdownLiteBlocks(text: string): MarkdownLiteBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((block) => {
      const headerMatch = block.match(/^(#{2,4})\s+(.*)$/)
      if (headerMatch) return { type: 'heading' as const, level: headerMatch[1].length, content: headerMatch[2].trim() }
      return { type: 'paragraph' as const, level: 0, content: block }
    })
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

export function renderMarkdownLiteBlock(block: MarkdownLiteBlock, key: string | number): ReactNode {
  if (block.type === 'heading') {
    const className = block.level <= 2 ? 'text-base font-bold mt-5 mb-1.5 first:mt-0' : 'text-sm font-semibold mt-4 mb-1'
    return block.level <= 2
      ? <h3 key={key} className={className}>{renderInline(block.content)}</h3>
      : <h4 key={key} className={className}>{renderInline(block.content)}</h4>
  }
  return <p key={key} className="text-sm leading-relaxed text-foreground/80 mb-3">{renderInline(block.content)}</p>
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const blocks = parseMarkdownLiteBlocks(text)
  return <div className={className}>{blocks.map((b, i) => renderMarkdownLiteBlock(b, i))}</div>
}
