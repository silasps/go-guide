'use client'

import { useTranslations } from 'next-intl'
import { WizardModal } from '@/components/shared/wizard-modal'
import { DiscardConfirmDialog } from '@/components/shared/discard-confirm-dialog'
import { StepAdjust } from '@/components/shared/media-editor/step-adjust'
import { useProjectComposer } from './use-project-composer'
import { StepCoverTitle } from './step-cover-title'
import { StepGoalSupport } from './step-goal-support'
import { StepStoryMilestones } from './step-story-milestones'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  onSaved: () => void
}

export function ProjectComposerModal({ open, onOpenChange, profileId, onSaved }: Props) {
  const t = useTranslations('ProjectComposer')
  const composer = useProjectComposer({ profileId, onSaved })
  const { step, setStep, coverMedia, setCoverMedia, coverAspect, discardConfirmOpen, setDiscardConfirmOpen, requestClose } = composer

  function close() {
    onOpenChange(false)
  }

  function handleAdvanceFromCover() {
    setStep(coverMedia ? 'adjust' : 'goal')
  }

  const titleKey = step === 'cover' ? 'stepCover' : step === 'adjust' ? 'stepAdjust' : step === 'goal' ? 'stepGoal' : 'stepStory'

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={onOpenChange}
        onRequestClose={() => requestClose(close)}
        title={t(titleKey)}
        closeLabel={t('close')}
        backLabel={t('back')}
        onBack={
          step === 'adjust' ? () => setStep('cover')
          : step === 'goal' ? () => setStep(coverMedia ? 'adjust' : 'cover')
          : step === 'story' ? () => setStep('goal')
          : undefined
        }
        rightLabel={t('next')}
        onRight={
          step === 'cover' ? handleAdvanceFromCover
          : step === 'adjust' ? () => setStep('goal')
          : step === 'goal' ? () => setStep('story')
          : undefined
        }
      >
        {step === 'cover' && <StepCoverTitle composer={composer} />}
        {step === 'adjust' && coverMedia && (
          <StepAdjust
            mediaFiles={[coverMedia]}
            activeIndex={0}
            onActiveIndexChange={() => {}}
            aspect={coverAspect}
            onChange={(_, patch) => setCoverMedia((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        )}
        {step === 'goal' && <StepGoalSupport composer={composer} />}
        {step === 'story' && <StepStoryMilestones composer={composer} />}
      </WizardModal>

      <DiscardConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        onDiscard={() => { setDiscardConfirmOpen(false); close() }}
        title={t('discardTitle')}
        description={t('discardDescription')}
        cancelLabel={t('discardCancel')}
        confirmLabel={t('discardConfirm')}
      />
    </>
  )
}
