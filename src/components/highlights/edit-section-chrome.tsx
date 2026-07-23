'use client'

import { Pencil, Loader2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EditPencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute top-0 right-0 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 backdrop-blur ring-1 ring-foreground/10 text-muted-foreground hover:text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  )
}

export function EditActions({ saving, onCancel, onSave, cancelLabel, saveLabel }: {
  saving: boolean
  onCancel: () => void
  onSave: () => void
  cancelLabel: string
  saveLabel: string
}) {
  return (
    <div className="flex gap-2 justify-end">
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
        <X className="h-3.5 w-3.5 mr-1" /> {cancelLabel}
      </Button>
      <Button type="button" size="sm" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} {saveLabel}
      </Button>
    </div>
  )
}
