'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { PostComposerModal } from '@/components/dashboard/post-composer/post-composer-modal'
import { Post } from '@/types/database'
import type { Locale } from '@/i18n/config'

interface ComposerContextValue {
  openComposer: (post?: Post) => void
  closeComposer: () => void
}

const ComposerContext = createContext<ComposerContextValue | null>(null)

export function useComposer() {
  const ctx = useContext(ComposerContext)
  if (!ctx) throw new Error('useComposer deve ser usado dentro de PostComposerProvider')
  return ctx
}

interface Props {
  profileId: string
  userId: string
  displayName: string
  avatarUrl?: string | null
  originalLocale: Locale
  children: ReactNode
}

export function PostComposerProvider({ profileId, userId, originalLocale, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | undefined>(undefined)

  function openComposer(post?: Post) {
    setEditingPost(post)
    setIsOpen(true)
  }

  function closeComposer() {
    setIsOpen(false)
    setEditingPost(undefined)
  }

  return (
    <ComposerContext.Provider value={{ openComposer, closeComposer }}>
      {children}
      {isOpen && (
        <PostComposerModal
          key={editingPost?.id ?? 'new'}
          open={isOpen}
          onOpenChange={(next) => (next ? setIsOpen(true) : closeComposer())}
          post={editingPost}
          profileId={profileId}
          userId={userId}
          originalLocale={originalLocale}
          onSaved={closeComposer}
        />
      )}
    </ComposerContext.Provider>
  )
}
