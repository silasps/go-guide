interface ProjectionInput {
  raisedAmount: number
  goalAmount: number | null
  createdAt: string
  fundingDeadline: string | null
}

export interface FundingProjection {
  dailyPace: number
  daysRemaining: number | null
  projectedFinal: number
  status: 'green' | 'yellow' | 'red' | 'neutral'
}

const MS_PER_DAY = 86_400_000

export function computeFundingProjection({ raisedAmount, goalAmount, createdAt, fundingDeadline }: ProjectionInput): FundingProjection {
  const daysSinceCreated = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / MS_PER_DAY))
  const dailyPace = raisedAmount / daysSinceCreated

  const daysRemaining = fundingDeadline
    ? Math.max(0, Math.ceil((new Date(fundingDeadline).getTime() - Date.now()) / MS_PER_DAY))
    : null

  const projectedFinal = daysRemaining !== null
    ? raisedAmount + dailyPace * daysRemaining
    : raisedAmount

  if (!goalAmount || goalAmount <= 0) {
    return { dailyPace, daysRemaining, projectedFinal, status: 'neutral' }
  }

  const projectedPct = (projectedFinal / goalAmount) * 100
  const status = projectedPct >= 100 ? 'green' : projectedPct >= 80 ? 'yellow' : 'red'

  return { dailyPace, daysRemaining, projectedFinal, status }
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / MS_PER_DAY)
}
