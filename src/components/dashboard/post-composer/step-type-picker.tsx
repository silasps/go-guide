'use client'

import { useTranslations } from 'next-intl'
import { FileText, FolderPlus } from 'lucide-react'

interface Props {
  onPickPost: () => void
  onPickProject: () => void
}

export function StepTypePicker({ onPickPost, onPickProject }: Props) {
  const t = useTranslations('PostComposer')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto py-8">
      <button
        type="button"
        onClick={onPickPost}
        className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center hover:bg-muted/50 transition-colors"
      >
        <FileText className="h-7 w-7 text-primary" />
        <div>
          <p className="font-medium">{t('typePost')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('typePostHint')}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={onPickProject}
        className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center hover:bg-muted/50 transition-colors"
      >
        <FolderPlus className="h-7 w-7 text-support" />
        <div>
          <p className="font-medium">{t('typeProject')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('typeProjectHint')}</p>
        </div>
      </button>
    </div>
  )
}
