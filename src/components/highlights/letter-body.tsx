import Image from 'next/image'
import { parseMarkdownLiteBlocks, renderMarkdownLiteBlock } from '@/lib/text/markdown-lite'

interface Props {
  letter: string
  imageUrl: string | null
  imageCaption: string | null
  imageUrl2: string | null
  imageCaption2: string | null
}

// Quebra o texto corrido da "carta" do projeto em até 3 grupos de blocos e
// intercala as (até 2) imagens configuradas entre eles — pedido do usuário
// pra não ficar um textão chapado sem nenhuma foto no meio. Cabeçalhos
// (## / ###) e **negrito** viram elementos de verdade via markdown-lite,
// não símbolos crus na tela.
export function LetterBody({ letter, imageUrl, imageCaption, imageUrl2, imageCaption2 }: Props) {
  const blocks = parseMarkdownLiteBlocks(letter)
  const third = Math.max(1, Math.ceil(blocks.length / 3))
  const groups = [blocks.slice(0, third), blocks.slice(third, third * 2), blocks.slice(third * 2)]

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {groups[0].map((b, i) => renderMarkdownLiteBlock(b, `c1-${i}`))}
      <LetterImage src={imageUrl} caption={imageCaption} />
      {groups[1].map((b, i) => renderMarkdownLiteBlock(b, `c2-${i}`))}
      <LetterImage src={imageUrl2} caption={imageCaption2} />
      {groups[2].map((b, i) => renderMarkdownLiteBlock(b, `c3-${i}`))}
    </div>
  )
}

function LetterImage({ src, caption }: { src: string | null; caption: string | null }) {
  if (!src) return null
  return (
    <figure className="not-prose my-4 space-y-1.5">
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted">
        <Image src={src} alt={caption ?? ''} fill sizes="(min-width: 640px) 42rem, 100vw" className="object-cover" />
      </div>
      {caption && <figcaption className="text-xs text-muted-foreground text-center">{caption}</figcaption>}
    </figure>
  )
}
