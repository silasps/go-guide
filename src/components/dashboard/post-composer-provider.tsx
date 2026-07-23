'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PostEditor } from '@/components/dashboard/post-editor'
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

export function PostComposerProvider({ profileId, userId, displayName, avatarUrl, originalLocale, children }: Props) {
  const t = useTranslations('PostComposer')
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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPost ? t('titleEdit') : t('title')}</DialogTitle>
          </DialogHeader>
          {isOpen && (
            <PostEditor
              key={editingPost?.id ?? 'new'}
              post={editingPost}
              profileId={profileId}
              userId={userId}
              originalLocale={originalLocale}
              displayName={displayName}
              avatarUrl={avatarUrl}
              onSaved={closeComposer}
            />
          )}
        </DialogContent>
      </Dialog>
    </ComposerContext.Provider>
  )
}
