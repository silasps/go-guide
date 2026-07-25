'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { BackButton } from '@/components/ui/back-button'
import type { Post } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { usePostComposer } from './use-post-composer'
import { StepTypePicker } from './step-type-picker'
import { StepMediaSelect } from './step-media-select'
import { StepAdjust } from './step-adjust'
import { StepDetails } from './step-details'
import { DiscardConfirmDialog } from './discard-confirm-dialog'

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
      <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(close); else onOpenChange(true) }}>
        <DialogContent
          showCloseButton={false}
          className="fixed inset-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full max-w-none rounded-none p-0 gap-0 overflow-y-hidden"
        >
          <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 px-4 py-3 border-b shrink-0">
            {step === 'media' || step === 'adjust' ? (
              <BackButton onClick={() => setStep(step === 'adjust' ? 'media' : 'type')} label={t('back')} />
            ) : (
              <button type="button" onClick={() => requestClose(close)} aria-label={t('close')} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            )}
            <DialogTitle className="text-center text-base truncate">{t(titleKey)}</DialogTitle>
            {step === 'media' ? (
              <button
                type="button"
                onClick={handleAdvanceFromMedia}
                disabled={mediaFiles.length === 0}
                className="text-sm font-semibold text-primary disabled:opacity-40 justify-self-end"
              >
                {t('next')}
              </button>
            ) : step === 'adjust' ? (
              <button type="button" onClick={() => setStep('details')} className="text-sm font-semibold text-primary justify-self-end">
                {t('next')}
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
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
          </div>

          {mediaError && (
            <p className="px-4 pb-2 text-xs text-destructive shrink-0">{mediaError}</p>
          )}
        </DialogContent>
      </Dialog>

      <DiscardConfirmDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen} onDiscard={() => { setDiscardConfirmOpen(false); close() }} />
    </>
  )
}
