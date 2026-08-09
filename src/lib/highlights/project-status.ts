// Fora de dates-status-edit-section.tsx (que é 'use client') de propósito:
// importar uma constante simples de um módulo client component pra dentro
// de um Server Component não é seguro (funciona no build de produção mas
// quebra em runtime/dev com Turbopack — "STATUS_OPTIONS.find is not a
// function"). Módulo neutro, importável dos dois lados.
export const STATUS_OPTIONS = [
  { value: 'active', label: '🟢 Ativo' },
  { value: 'completed', label: '✅ Concluído' },
  { value: 'hidden', label: '🔒 Oculto' },
] as const
