'use client'

interface Slice {
  id: string
  label: string
  value: number
  color: string
  pct: number
}

interface Props {
  slices: Slice[]
  centerLabel: string
  size?: number
}

const STROKE = 14

// Anel de composição — "quanto do total cada meta representa" (parte de um
// todo com um número-herói no centro, não comparação entre categorias
// soltas — caso legítimo pra donut na dataviz skill, diferente do
// `CategoryBarChart`, que é comparação e usa barra). Poucos segmentos
// (metas ativas normalmente são poucas), cor categórica já validada
// (chart-3..8), legenda sempre ao lado (ver GoalsList) — nunca só a cor.
export function DonutChart({ slices, centerLabel, size = 128 }: Props) {
  const r = (size - STROKE) / 2
  const circumference = 2 * Math.PI * r

  const positioned = slices.map((s, i) => ({
    ...s,
    offsetPct: slices.slice(0, i).reduce((sum, prev) => sum + prev.pct, 0),
  }))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Total guardado: ${centerLabel}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {positioned.map((s) => {
            const dash = (s.pct / 100) * circumference
            const gap = circumference - dash
            const offset = -((s.offsetPct / 100) * circumference)
            return (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
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
      </svg>
      <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
        <span className="text-xs font-semibold tabular-nums leading-tight">{centerLabel}</span>
      </div>
    </div>
  )
}
