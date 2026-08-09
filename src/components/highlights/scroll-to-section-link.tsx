'use client'

interface Props {
  targetId: string
  label: string
}

export function ScrollToSectionLink({ targetId, label }: Props) {
  function handleClick() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button type="button" onClick={handleClick} className="text-xs text-primary hover:underline">
      {label}
    </button>
  )
}
