import type { HistoryBlock } from '@/types/history'

interface Props { blocks: HistoryBlock[] }

export function HistoryView({ blocks }: Props) {
  if (!blocks.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>A história deste missionário ainda não foi escrita.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {blocks.map(b => <HistoryBlock key={b.id} block={b} />)}
    </div>
  )
}

function HistoryBlock({ block }: { block: HistoryBlock }) {
  const c = block.content as Record<string, unknown>

  if (block.type === 'who_we_are') {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{(c.title as string) || 'Quem somos'}</h2>
        <p className="text-muted-foreground leading-relaxed">{c.text as string}</p>
      </section>
    )
  }

  if (block.type === 'our_calling') {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{(c.title as string) || 'Nosso chamado'}</h2>
        <p className="text-muted-foreground leading-relaxed">{c.text as string}</p>
      </section>
    )
  }

  if (block.type === 'timeline') {
    const items = (c.items as Array<{ year: string; text: string }>) ?? []
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{(c.title as string) || 'Linha do tempo'}</h2>
        <div className="space-y-3 border-l-2 border-border pl-4">
          {items.map((item, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[21px] h-3 w-3 rounded-full bg-primary border-2 border-background top-1" />
              <p className="text-sm font-semibold text-primary">{item.year}</p>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (block.type === 'cta') {
    return (
      <section className="rounded-xl bg-primary/5 border border-primary/20 p-6 text-center space-y-3">
        <h2 className="text-lg font-bold">{(c.title as string) || 'Caminhe conosco'}</h2>
        {c.text ? <p className="text-muted-foreground text-sm">{c.text as string}</p> : null}
      </section>
    )
  }

  return (
    <section>
      <p className="text-muted-foreground leading-relaxed">{c.text as string}</p>
    </section>
  )
}
