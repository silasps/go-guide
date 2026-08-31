import type { HistoryBlock } from '@/types/history'
import type { ContentTranslation, Locale } from '@/types/database'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'

interface Props { blocks: HistoryBlock[]; visitorLocale: Locale }

export function HistoryView({ blocks, visitorLocale }: Props) {
  if (!blocks.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>A história deste missionário ainda não foi escrita.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {blocks.map(b => <HistoryBlock key={b.id} block={b} visitorLocale={visitorLocale} />)}
    </div>
  )
}

type Translations = Partial<Record<Locale, ContentTranslation>> | undefined

function HistoryBlock({ block, visitorLocale }: { block: HistoryBlock; visitorLocale: Locale }) {
  const c = block.content as Record<string, unknown>
  const originalLocale = block.original_locale ?? 'pt'
  const title = resolveLocalizedText((c.title as string) ?? null, originalLocale, c.title_translations as Translations, visitorLocale).text
  const text = resolveLocalizedText((c.text as string) ?? null, originalLocale, c.text_translations as Translations, visitorLocale).text

  if (block.type === 'who_we_are') {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{title || 'Quem somos'}</h2>
        <p className="text-muted-foreground leading-relaxed">{text}</p>
      </section>
    )
  }

  if (block.type === 'our_calling') {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{title || 'Nosso chamado'}</h2>
        <p className="text-muted-foreground leading-relaxed">{text}</p>
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
      </section>
    )
  }

  return (
    <section>
      <p className="text-muted-foreground leading-relaxed">{c.text as string}</p>
    </section>
  )
}
