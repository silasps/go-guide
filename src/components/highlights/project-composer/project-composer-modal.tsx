'use client'

import { useTranslations } from 'next-intl'
import { WizardModal } from '@/components/shared/wizard-modal'
import { DiscardConfirmDialog } from '@/components/shared/discard-confirm-dialog'
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
  const { step, setStep, discardConfirmOpen, setDiscardConfirmOpen, requestClose } = composer

  function close() {
    onOpenChange(false)
  }

  const titleKey = step === 'cover' ? 'stepCover' : step === 'goal' ? 'stepGoal' : 'stepStory'

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={onOpenChange}
        onRequestClose={() => requestClose(close)}
        title={t(titleKey)}
        closeLabel={t('close')}
        backLabel={t('back')}
        onBack={step === 'goal' ? () => setStep('cover') : step === 'story' ? () => setStep('goal') : undefined}
        rightLabel={t('next')}
        onRight={step === 'cover' ? () => setStep('goal') : step === 'goal' ? () => setStep('story') : undefined}
      >
        {step === 'cover' && <StepCoverTitle composer={composer} />}
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
