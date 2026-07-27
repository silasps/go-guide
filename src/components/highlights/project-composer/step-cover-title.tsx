'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CoverEditor } from '@/components/highlights/cover-editor'
import type { useProjectComposer } from './use-project-composer'

interface Props {
  composer: ReturnType<typeof useProjectComposer>
}

export function StepCoverTitle({ composer }: Props) {
  const t = useTranslations('ProjectComposer')
  const { title, setTitle, description, setDescription, coverPreview, position, setCover } = composer

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label>{t('coverLabel')}</Label>
          <span className="text-xs text-muted-foreground">{t('coverHint')}</span>
        </div>
        <CoverEditor initialUrl={coverPreview} initialPosition={position} onChange={setCover} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">{t('titleLabel')}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('descriptionLabel')}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          rows={3}
        />
      </div>
    </div>
  )
}
