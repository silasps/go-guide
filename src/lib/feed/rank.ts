import { PostWithProfile, ProjectCategory } from '@/types/database'

export interface AffinitySignals {
  followedProfileIds: Set<string>
  pledgedProfileIds: Set<string>
  activeRecurringProfileIds: Set<string>
  affinityCategories: Set<ProjectCategory>
}

/**
 * Heurística v1, transparente e explicável — nada de ML ainda. Pesos
 * nomeados num lugar só pra ficar fácil de ajustar e, no futuro, trocar por
 * um modelo treinado a partir de feed_events sem mexer no resto do pipeline.
 */
export function scorePost(post: PostWithProfile, signals: AffinitySignals): number {
  let score = 0

  const hoursAgo = post.published_at
    ? (Date.now() - new Date(post.published_at).getTime()) / 36e5
    : 0
  score += Math.max(0, 100 - hoursAgo * 0.5)

  if (signals.followedProfileIds.has(post.profile_id)) score += 50
  if (signals.pledgedProfileIds.has(post.profile_id)) score += 30
  if (signals.activeRecurringProfileIds.has(post.profile_id)) score += 20
  if (post.highlight?.category?.some((c) => signals.affinityCategories.has(c))) score += 15

  return score
}
