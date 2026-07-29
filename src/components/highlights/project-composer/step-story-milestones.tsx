'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { MilestonesEditor } from '@/components/highlights/milestones-editor'
import type { useProjectComposer } from './use-project-composer'

interface Props {
  composer: ReturnType<typeof useProjectComposer>
}

export function StepStoryMilestones({ composer }: Props) {
  const t = useTranslations('ProjectComposer')
  const {
    tripStartDate, setTripStartDate, fundingDeadline, setFundingDeadline,
    scripture, setScripture, letter, setLetter,
    milestones, setMilestones,
    saving, handleSave,
  } = composer

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="trip_start_date">{t('tripDateLabel')}</Label>
          <Input id="trip_start_date" type="date" className="w-full max-w-full" value={tripStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTripStartDate(e.target.value)} />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="funding_deadline">{t('deadlineLabel')}</Label>
          <Input id="funding_deadline" type="date" className="w-full max-w-full" value={fundingDeadline} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFundingDeadline(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scripture">{t('scriptureLabel')}</Label>
        <Textarea
          id="scripture"
          value={scripture}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScripture(e.target.value)}
          placeholder={t('scripturePlaceholder')}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="letter">{t('letterLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('letterHint')}</p>
        <Textarea
          id="letter"
          value={letter}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLetter(e.target.value)}
          placeholder={t('letterPlaceholder')}
          rows={6}
        />
      </div>

      <div className="space-y-3">
        <Label>{t('milestonesLabel')}</Label>
        <MilestonesEditor milestones={milestones} onChange={setMilestones} />
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('createProject')}
        </Button>
      </div>
    </div>
  )
}
