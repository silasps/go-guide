'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ProjectStory } from '@/types/database'
import { ProjectStoryViewer } from './project-story-viewer'

interface Props {
  stories: ProjectStory[]
}

// Faixa horizontal estilo Instagram — mesmo visual de projects-section.tsx
// (capa circular + anel), mas a fonte é "projetos de quem eu sigo/apoio"
// em vez do próprio perfil, e o anel vira gradiente quando hasUnseen.
export function ProjectStoriesRow({ stories }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  if (stories.length === 0) return null

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {stories.map((story, i) => (
          <button
            key={story.highlight.id}
            onClick={() => setActiveIndex(i)}
            className="flex flex-col items-center gap-1.5 w-[72px] shrink-0 snap-start"
          >
            <div
              className="h-16 w-16 rounded-full p-[2px] shrink-0"
              style={{
                background: story.hasUnseen
                  ? 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)'
                  : `${story.profile.accent_color}55`,
              }}
            >
              <div className="h-full w-full rounded-full overflow-hidden bg-background p-[2px]">
                <div className="h-full w-full rounded-full overflow-hidden bg-muted">
                  {story.highlight.cover_url ? (
                    <Image
                      src={story.highlight.cover_url}
                      alt={story.highlight.title}
                      width={64}
                      height={64}
                      className="object-cover h-full w-full"
                      style={{ objectPosition: story.highlight.cover_position ?? '50% 50%' }}
                    />
                  ) : (
                    <div
                      className="h-full w-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: story.profile.accent_color + '20' }}
                    >
                      🌍
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[11px] font-medium leading-tight text-center line-clamp-2">
              {story.highlight.title}
            </p>
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <ProjectStoryViewer
          stories={stories}
          initialIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </>
  )
}
