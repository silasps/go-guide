'use client'

import { useTranslations } from 'next-intl'
import { WizardModal } from '@/components/shared/wizard-modal'
import { DiscardConfirmDialog } from '@/components/shared/discard-confirm-dialog'
import type { Post } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { usePostComposer } from './use-post-composer'
import { StepTypePicker } from './step-type-picker'
import { StepMediaSelect } from './step-media-select'
import { StepAdjust } from '@/components/shared/media-editor/step-adjust'
import { StepDetails } from './step-details'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  post?: Post
  profileId: string
  userId: string
  originalLocale: Locale
  onSaved: () => void
}

export function PostComposerModal({ open, onOpenChange, post, profileId, userId, originalLocale, onSaved }: Props) {
  const t = useTranslations('PostComposer')
  const composer = usePostComposer({ post, profileId, userId, originalLocale, onSaved })
  const { step, setStep, mediaFiles, mediaError, discardConfirmOpen, setDiscardConfirmOpen, requestClose, pickProject } = composer

  function close() {
    onOpenChange(false)
  }

  function handleAdvanceFromMedia() {
    setStep(mediaFiles.some((m) => m.type === 'image') ? 'adjust' : 'details')
  }

  const hasImages = mediaFiles.some((m) => m.type === 'image')
  const titleKey = step === 'type' ? 'title' : step === 'media' ? 'stepMedia' : step === 'adjust' ? 'stepAdjust' : post ? 'titleEdit' : 'stepDetails'

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={onOpenChange}
        onRequestClose={() => requestClose(close)}
        title={t(titleKey)}
        closeLabel={t('close')}
        backLabel={t('back')}
        onBack={step === 'media' || step === 'adjust' ? () => setStep(step === 'adjust' ? 'media' : 'type') : undefined}
        rightLabel={t('next')}
        onRight={
          step === 'media' ? handleAdvanceFromMedia
          : step === 'adjust' ? () => setStep('details')
          : undefined
        }
        rightDisabled={step === 'media' && mediaFiles.length === 0}
        footer={mediaError && <p className="px-4 pb-2 text-xs text-destructive shrink-0">{mediaError}</p>}
      >
        {step === 'type' && <StepTypePicker onPickPost={() => setStep('media')} onPickProject={pickProject} />}
        {step === 'media' && (
          <StepMediaSelect
            mediaFiles={mediaFiles}
            onMediaChange={composer.setMediaFiles}
            activeIndex={composer.activeIndex}
            onActiveIndexChange={composer.setActiveIndex}
            aspect={composer.aspect}
            onAspectChange={composer.setAspect}
            onError={composer.setMediaError}
          />
        )}
        {step === 'adjust' && hasImages && (
          <StepAdjust
            mediaFiles={mediaFiles}
            activeIndex={composer.activeIndex}
            onActiveIndexChange={composer.setActiveIndex}
            aspect={composer.aspect}
            onChange={(index, patch) => composer.setMediaFiles((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))}
          />
        )}
        {step === 'details' && <StepDetails composer={composer} profileId={profileId} />}
      </WizardModal>

      <DiscardConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        onDiscard={() => { setDiscardConfirmOpen(false); close() }}
        title={post ? t('discardTitleEdit') : t('discardTitle')}
        description={t('discardDescription')}
        cancelLabel={t('discardCancel')}
        confirmLabel={t('discardConfirm')}
      />
    </>
  )
}
