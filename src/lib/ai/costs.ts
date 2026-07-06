export const AI_ACTION_COSTS = {
  translate_content: 1,
} as const

export type AiAction = keyof typeof AI_ACTION_COSTS
