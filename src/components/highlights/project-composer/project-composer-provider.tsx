'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { ProjectComposerModal } from './project-composer-modal'

interface ProjectComposerContextValue {
  openProjectComposer: () => void
  closeProjectComposer: () => void
}

const ProjectComposerContext = createContext<ProjectComposerContextValue | null>(null)

export function useProjectComposer() {
  const ctx = useContext(ProjectComposerContext)
  if (!ctx) throw new Error('useProjectComposer deve ser usado dentro de ProjectComposerProvider')
  return ctx
}

interface Props {
  profileId: string
  children: ReactNode
}

export function ProjectComposerProvider({ profileId, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  function openProjectComposer() {
    setIsOpen(true)
  }

  function closeProjectComposer() {
    setIsOpen(false)
  }

  return (
    <ProjectComposerContext.Provider value={{ openProjectComposer, closeProjectComposer }}>
      {children}
      {isOpen && (
        <ProjectComposerModal
          open={isOpen}
          onOpenChange={(next) => (next ? setIsOpen(true) : closeProjectComposer())}
          profileId={profileId}
          onSaved={closeProjectComposer}
        />
      )}
    </ProjectComposerContext.Provider>
  )
}
