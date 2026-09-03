'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { HeartHandshake, Play } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarkdownLite } from '@/lib/text/markdown-lite'
import type { HistoryBlock } from '@/types/history'
import type { ContentTranslation, Locale, PostWithProfile } from '@/types/database'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { HistorySectionNav, type HistorySection } from '@/components/history/section-nav'
import { PostDetailViewer } from '@/components/shared/post-detail-viewer'

interface NavLabels { who_we_are: string; our_calling: string; timeline: string; cta: string }
interface Props { blocks: HistoryBlock[]; visitorLocale: Locale; username: string; ctaButtonLabel?: string; navLabels: NavLabels; linkedPosts?: PostWithProfile[] }

const SECTION_ANCHOR: Record<string, string> = {
  who_we_are: 'history-who_we_are',
  our_calling: 'history-our_calling',
  timeline: 'history-timeline',
  cta: 'history-cta',
}

export function HistoryView({ blocks, visitorLocale, username, ctaButtonLabel = 'Faça parte', navLabels, linkedPosts = [] }: Props) {
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const openIndex = linkedPosts.findIndex((p) => p.id === openPostId)

  if (!blocks.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>A história deste missionário ainda não foi escrita.</p>
      </div>
    )
  }

  // Rótulos fixos e curtos (Quem somos/Nosso chamado/...), nunca o título
  // livre que a pessoa escreveu na seção — um título como "Uma família que
  // ouve a Deus..." deixava os pills enormes; o título completo continua
  // aparecendo normalmente no <h2> de cada seção, só não dirige mais o pill.
  const sections: HistorySection[] = blocks
    .filter((b) => SECTION_ANCHOR[b.type])
    .map((b) => ({ id: SECTION_ANCHOR[b.type], label: navLabels[b.type as keyof NavLabels] }))

  return (
    <div>
      <HistorySectionNav sections={sections} scrollOffset={49} className="mb-6" />
      <div className="space-y-8">
        {blocks.map(b => (
          <HistoryBlockSection
            key={b.id}
            block={b}
            visitorLocale={visitorLocale}
            username={username}
            ctaButtonLabel={ctaButtonLabel}
            linkedPosts={linkedPosts}
            onOpenPost={setOpenPostId}
          />
        ))}
      </div>

      {linkedPosts.length > 0 && (
        <PostDetailViewer
          posts={linkedPosts}
          initialIndex={openIndex === -1 ? 0 : openIndex}
          visitorLocale={visitorLocale}
          open={openPostId !== null}
          onOpenChange={(next) => !next && setOpenPostId(null)}
        />
      )}
    </div>
  )
}

type Translations = Partial<Record<Locale, ContentTranslation>> | undefined
interface TimelineItemContent { year: string; text: string; text_translations?: Translations; post_id?: string; image_url?: string }

function HistoryBlockSection({ block, visitorLocale, username, ctaButtonLabel, linkedPosts, onOpenPost }: {
  block: HistoryBlock
  visitorLocale: Locale
  username: string
  ctaButtonLabel: string
  linkedPosts: PostWithProfile[]
  onOpenPost: (postId: string) => void
}) {
  const c = block.content as Record<string, unknown>
  const originalLocale = block.original_locale ?? 'pt'
  const title = resolveLocalizedText((c.title as string) ?? null, originalLocale, c.title_translations as Translations, visitorLocale).text
  const text = resolveLocalizedText((c.text as string) ?? null, originalLocale, c.text_translations as Translations, visitorLocale).text
  const images = c.images as string[] | undefined
  const anchorId = SECTION_ANCHOR[block.type]

  if (block.type === 'who_we_are') {
    return (
      <section id={anchorId} className="space-y-3 scroll-mt-24">
        <h2 className="text-lg font-bold">{title || 'Quem somos'}</h2>
        <MarkdownLite text={text ?? ''} className="text-muted-foreground" />
        {images && images.length > 0 && <HistoryGallery images={images} />}
      </section>
    )
  }

  if (block.type === 'our_calling') {
    return (
      <section id={anchorId} className="space-y-3 scroll-mt-24">
        <h2 className="text-lg font-bold">{title || 'Nosso chamado'}</h2>
        <MarkdownLite text={text ?? ''} className="text-muted-foreground" />
        {images && images.length > 0 && <HistoryGallery images={images} />}
      </section>
    )
  }

  if (block.type === 'timeline') {
    const items = (c.items as TimelineItemContent[]) ?? []
    return (
      <section id={anchorId} className="space-y-3 scroll-mt-24">
        <h2 className="text-lg font-bold">{title || 'Linha do tempo'}</h2>
        <div className="space-y-3 border-l-2 border-border pl-4">
          {items.map((item, i) => (
            <TimelineEntry
              key={i}
              year={item.year}
              text={resolveLocalizedText(item.text, originalLocale, item.text_translations, visitorLocale).text ?? ''}
              imageUrl={item.image_url}
              linkedPost={item.post_id ? linkedPosts.find((p) => p.id === item.post_id) : undefined}
              onOpenPost={onOpenPost}
            />
          ))}
        </div>
      </section>
    )
  }

  if (block.type === 'cta') {
    return (
      <section id={anchorId} className="rounded-xl bg-primary/5 border border-primary/20 p-6 text-center space-y-3 scroll-mt-24">
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

// Galeria em vez de 1 foto colada no texto — com 1 imagem mostra normal, com
// 2+ vira uma faixa horizontal com scroll-snap (leve, sem lib de carrossel).
function HistoryGallery({ images }: { images: string[] }) {
  if (images.length === 1) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted">
        <Image src={images[0]} alt="" fill sizes="(min-width: 640px) 42rem, 100vw" className="object-cover" />
      </div>
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
      {images.map((src, i) => (
        <div key={i} className="relative shrink-0 w-[70%] sm:w-[45%] aspect-square rounded-xl overflow-hidden bg-muted snap-start">
          <Image src={src} alt="" fill sizes="(min-width: 640px) 20rem, 70vw" className="object-cover" />
        </div>
      ))}
    </div>
  )
}

// Colapsado por padrão (ano + resumo de 1 linha) — toca pra ler o evento
// completo, em vez de empilhar tudo aberto numa página gigante. Um item com
// post vinculado abre o PostDetailViewer de verdade em vez de expandir —
// uma foto avulsa (sem post) é só decorativa, continua expandindo o texto.
function TimelineEntry({ year, text, imageUrl, linkedPost, onOpenPost }: {
  year: string
  text: string
  imageUrl?: string
  linkedPost?: PostWithProfile
  onOpenPost: (postId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const thumbnailUrl = linkedPost ? linkedPost.media_urls?.[0] : imageUrl

  function handleClick() {
    if (linkedPost) onOpenPost(linkedPost.id)
    else setExpanded((v) => !v)
  }

  return (
    <button type="button" onClick={handleClick} className="relative flex w-full items-start gap-3 text-left">
      <div className="absolute -left-[21px] h-3 w-3 rounded-full bg-primary border-2 border-background top-1" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary">{year}</p>
        <p className={cn('text-sm text-muted-foreground', !expanded && 'line-clamp-1')}>{text}</p>
      </div>
      {thumbnailUrl && (
        <div className="relative shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-muted">
          {linkedPost?.type === 'video' ? (
            <>
              <video src={thumbnailUrl} className="h-full w-full object-cover" muted />
              <Play className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow fill-white" />
            </>
          ) : (
            <Image src={thumbnailUrl} alt="" fill sizes="3rem" className="object-cover" />
          )}
        </div>
      )}
    </button>
  )
}
