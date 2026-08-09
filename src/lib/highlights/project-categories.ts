// Assunto do projeto (ortogonal ao goal_type, que é o TIPO DE APOIO
// pedido) — sinal de afinidade usado pelo ranking do feed, sem UI pública.
// Módulo neutro (não 'use client') pra poder ser importado tanto por
// formulários client quanto por Server Components (ex.: fallback de capa
// ausente) — mesma lição de `project-status.ts`.
export const PROJECT_CATEGORIES = [
  { value: 'children',                emoji: '🧒', label: 'Crianças' },
  { value: 'health',                  emoji: '🩺', label: 'Saúde' },
  { value: 'education',               emoji: '📚', label: 'Educação' },
  { value: 'evangelism',              emoji: '✝️', label: 'Evangelismo' },
  { value: 'community_development',   emoji: '🏘️', label: 'Desenvolvimento comunitário' },
  { value: 'disaster_relief',         emoji: '🆘', label: 'Desastres/emergência' },
  { value: 'other',                   emoji: '✨', label: 'Outro' },
] as const
