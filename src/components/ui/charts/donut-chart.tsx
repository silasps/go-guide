'use client'

import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface Slice {
  id: string
  label: string
  value: number
  color: string
  pct: number
}

interface Props {
  slices: Slice[]
  centerLabel: ReactNode
  size?: number
  ariaLabel?: string
  // Entrada animada: o anel gira/cresce e uma máscara varre os segmentos
  // num giro contínuo a partir do topo. Opt-in (Metas continua estática) e
  // desligada pra quem pede "reduzir movimento" no sistema.
  animated?: boolean
}

const STROKE = 14
const EASE_OUT = [0.22, 1, 0.36, 1] as const

// Anel de composição — "quanto do total cada meta representa" (parte de um
// todo com um número-herói no centro, não comparação entre categorias
// soltas — caso legítimo pra donut na dataviz skill, diferente do
// `CategoryBarChart`, que é comparação e usa barra). Poucos segmentos
// (metas ativas normalmente são poucas), cor categórica já validada
// (chart-3..8), legenda sempre ao lado (ver GoalsList) — nunca só a cor.
export function DonutChart({ slices, centerLabel, size = 128, ariaLabel, animated = false }: Props) {
  // useId pode trazer caracteres que quebram `url(#…)` — só o seguro.
  const maskId = `donut-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const reduceMotion = useReducedMotion()
  const animate = animated && !reduceMotion

  const r = (size - STROKE) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r

  const positioned = slices.map((s, i) => ({
    ...s,
    offsetPct: slices.slice(0, i).reduce((sum, prev) => sum + prev.pct, 0),
  }))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <motion.div
        initial={animate ? { opacity: 0, scale: 0.85, rotate: -40 } : false}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel ?? (typeof centerLabel === 'string' ? `Total guardado: ${centerLabel}` : undefined)}
        >
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
          <g transform={`rotate(-90 ${c} ${c})`}>
            {animate && (
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
                  <motion.circle
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke="white"
                    strokeWidth={STROKE + 2}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 }}
                  />
                </mask>
              </defs>
            )}
            <g mask={animate ? `url(#${maskId})` : undefined}>
              {positioned.map((s) => {
                const dash = (s.pct / 100) * circumference
                const gap = circumference - dash
                const offset = -((s.offsetPct / 100) * circumference)
                return (
                  <circle
                    key={s.id}
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={offset}
                    strokeLinecap={slices.length > 1 ? 'butt' : 'round'}
                  />
                )
              })}
            </g>
          </g>
        </svg>
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center px-2 text-center"
        initial={animate ? { opacity: 0, scale: 0.8 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}
      >
        <span className="text-xs font-semibold tabular-nums leading-tight">{centerLabel}</span>
      </motion.div>
    </div>
  )
}
