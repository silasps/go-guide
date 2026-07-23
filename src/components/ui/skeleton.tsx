function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />
}

function SkText({ w = 'w-32', h = 'h-4' }: { w?: string; h?: string }) {
  return <Sk className={`${w} ${h}`} />
}

/** Cabeçalho de página (título + ação) */
function SkHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      <Sk className="h-6 w-40" />
      <Sk className="h-8 w-24 rounded-lg" />
    </div>
  )
}

/** Linhas de tabela/lista */
function SkTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  const mobileCols = Math.min(cols, 2)
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="bg-muted/50 border-b px-4 py-3 flex gap-4 md:gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className={`h-4 flex-1 ${i >= mobileCols ? 'hidden md:block' : ''}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 md:gap-6 border-b last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Sk
              key={c}
              className={`h-4 flex-1 ${c === 0 ? 'max-w-[180px]' : ''} ${c >= mobileCols ? 'hidden md:block' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Cards de estatística (grid no topo de dashboards) */
function SkStatCards({ n = 4 }: { n?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 md:gap-4 ${n >= 4 ? 'md:grid-cols-4' : n >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border p-3 md:p-5 flex items-start gap-3 md:gap-4">
          <Sk className="w-8 h-8 md:w-10 md:h-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5 md:space-y-2 pt-0.5 md:pt-1">
            <Sk className="h-5 md:h-6 w-10 md:w-12" />
            <Sk className="h-3 w-16 md:w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Grid de cards (publicações, projetos, destaques...) */
function SkCardGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border p-5 space-y-3">
          <div className="flex justify-between items-start">
            <Sk className="h-5 w-36" />
            <Sk className="h-5 w-14 rounded-full" />
          </div>
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}

/** Lista vertical (mensagens, orações, parceiros...) */
function SkList({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 flex items-center gap-3">
          <Sk className="size-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Sk className="h-4 w-1/3" />
            <Sk className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Faixa horizontal de stories (projetos de quem eu sigo) */
function SkStories({ n = 6 }: { n?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 w-[72px] shrink-0">
          <Sk className="h-16 w-16 rounded-full" />
          <Sk className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  )
}

/** Cards de post do feed (avatar + mídia + texto) */
function SkFeedPosts({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="p-4 rounded-2xl border bg-card space-y-3">
          <div className="flex items-center gap-2.5">
            <Sk className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Sk className="h-3.5 w-28" />
              <Sk className="h-3 w-20" />
            </div>
            <Sk className="h-7 w-16 rounded-lg shrink-0" />
          </div>
          <Sk className="aspect-video w-full rounded-xl" />
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

/** Formulário (campos empilhados) */
function SkForm({ n = 4 }: { n?: number }) {
  return (
    <div className="max-w-lg space-y-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Sk className="h-3 w-24" />
          <Sk className="h-9 w-full rounded-lg" />
        </div>
      ))}
      <Sk className="h-9 w-28 rounded-lg" />
    </div>
  )
}

export { Sk, SkText, SkHeader, SkTable, SkStatCards, SkCardGrid, SkList, SkForm, SkStories, SkFeedPosts }
