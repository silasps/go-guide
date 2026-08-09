'use client'

import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useHighlightSectionSave } from '@/hooks/use-highlight-section-save'
import { STATUS_OPTIONS } from '@/lib/highlights/project-status'
import type { SectionProps } from './section-types'

type Props = Pick<SectionProps, 'canEdit' | 'snapshot' | 'highlightId' | 'profileId'>

// Status precisa ficar visível E editável direto dali — não só dentro do
// formulário de edição de datas, que ninguém abre pra só trocar o status
// (feedback direto do usuário). Pra quem não pode editar, é só um badge.
export function StatusBadge({ canEdit, snapshot, highlightId, profileId }: Props) {
  const { saving, save } = useHighlightSectionSave()
  const current = STATUS_OPTIONS.find((s) => s.value === snapshot.status)
  const variant = snapshot.status === 'completed' ? 'success' : 'secondary'

  if (!canEdit) {
    return <Badge variant={variant} className="text-xs shrink-0">{current?.label ?? snapshot.status}</Badge>
  }

  function handleSelect(status: string) {
    if (status === snapshot.status || saving) return
    save({ ...snapshot, highlightId, profileId, status })
  }

  return (
    <DropdownMenu>
      {/* Base UI exige um <button> nativo de verdade no trigger do menu —
          Badge renderiza <span> por padrão, então passa render={<button/>}
          pra ela mesma virar o botão (mesmo mecanismo de composição do
          render prop, só que em dois níveis: Trigger -> Badge -> button). */}
      <DropdownMenuTrigger
        render={
          <Badge
            variant={variant}
            render={<button type="button" />}
            className="text-xs shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {saving ? '...' : (current?.label ?? snapshot.status)}
          </Badge>
        }
      />
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => handleSelect(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
