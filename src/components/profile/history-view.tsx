import Image from 'next/image'
import Link from 'next/link'
import { HeartHandshake } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarkdownLite } from '@/lib/text/markdown-lite'
import type { HistoryBlock } from '@/types/history'
import type { ContentTranslation, Locale } from '@/types/database'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'

interface Props { blocks: HistoryBlock[]; visitorLocale: Locale; username: string; ctaButtonLabel?: string }

export function HistoryView({ blocks, visitorLocale, username, ctaButtonLabel = 'Faça parte' }: Props) {
  if (!blocks.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>A história deste missionário ainda não foi escrita.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {blocks.map(b => <HistoryBlock key={b.id} block={b} visitorLocale={visitorLocale} username={username} ctaButtonLabel={ctaButtonLabel} />)}
    </div>
  )
}

type Translations = Partial<Record<Locale, ContentTranslation>> | undefined

function HistoryBlock({ block, visitorLocale, username, ctaButtonLabel }: { block: HistoryBlock; visitorLocale: Locale; username: string; ctaButtonLabel: string }) {
  const c = block.content as Record<string, unknown>
  const originalLocale = block.original_locale ?? 'pt'
  const title = resolveLocalizedText((c.title as string) ?? null, originalLocale, c.title_translations as Translations, visitorLocale).text
  const text = resolveLocalizedText((c.text as string) ?? null, originalLocale, c.text_translations as Translations, visitorLocale).text
  const imageUrl = c.image_url as string | undefined
  const imageCaption = c.image_caption as string | undefined

  if (block.type === 'who_we_are') {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{title || 'Quem somos'}</h2>
        <MarkdownLite text={text ?? ''} className="text-muted-foreground" />
        {imageUrl && <HistoryImage src={imageUrl} caption={imageCaption} />}
      </section>
    )
  }

  if (block.type === 'our_calling') {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{title || 'Nosso chamado'}</h2>
        <MarkdownLite text={text ?? ''} className="text-muted-foreground" />
        {imageUrl && <HistoryImage src={imageUrl} caption={imageCaption} />}
      </section>
    )
  }

  if (block.type === 'timeline') {
    const items = (c.items as Array<{ year: string; text: string; text_translations?: Translations }>) ?? []
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{title || 'Linha do tempo'}</h2>
        <div className="space-y-3 border-l-2 border-border pl-4">
          {items.map((item, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[21px] h-3 w-3 rounded-full bg-primary border-2 border-background top-1" />
              <p className="text-sm font-semibold text-primary">{item.year}</p>
              <p className="text-sm text-muted-foreground">{resolveLocalizedText(item.text, originalLocale, item.text_translations, visitorLocale).text}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (block.type === 'cta') {
    return (
      <section className="rounded-xl bg-primary/5 border border-primary/20 p-6 text-center space-y-3">
        <h2 className="text-lg font-bold">{title || 'Caminhe conosco'}</h2>
        {text ? <p className="text-muted-foreground text-sm">{text}</p> : null}
        <Link href={`/${username}/parceria`} className={cn(buttonVariants({ variant: 'support' }), 'gap-2')}>
          <HeartHandshake className="h-4 w-4" />
          {ctaButtonLabel}
        </Link>
      </section>
    )
  }

  return (
    <section>
      <MarkdownLite text={c.text as string} className="text-muted-foreground" />
    </section>
  )
}

// Quebra o texto corrido com uma foto real dessa fase da história — pedido
// do usuário pra não ficar um "textão chapado" sem nenhuma imagem no meio.
function HistoryImage({ src, caption }: { src: string; caption?: string }) {
  return (
    <figure className="space-y-1.5">
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted">
        <Image src={src} alt={caption ?? ''} fill sizes="(min-width: 640px) 42rem, 100vw" className="object-cover" />
      </div>
      {caption && <figcaption className="text-xs text-muted-foreground text-center">{caption}</figcaption>}
    </figure>
  )
}
