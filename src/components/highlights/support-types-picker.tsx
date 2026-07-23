'use client'

export const GOAL_TYPE_OPTIONS = [
  { value: 'financial',   emoji: '💰', label: 'Apoio financeiro',    desc: 'Doação mensal ou pontual' },
  { value: 'prayer',      emoji: '🙏', label: 'Oração',              desc: 'Compromisso de orar regularmente' },
  { value: 'ambassador',  emoji: '📣', label: 'Divulgação',           desc: 'Compartilhar o projeto e trazer novos apoiadores' },
  { value: 'volunteer',   emoji: '🤝', label: 'Voluntário',          desc: 'Apoio pessoal ou com habilidades' },
  { value: 'ongoing',     emoji: '🔄', label: 'Ministério contínuo', desc: 'Sem meta específica, apoio de longo prazo' },
] as const

interface Props {
  selected: string[]
  onChange: (types: string[]) => void
}

export function SupportTypesPicker({ selected, onChange }: Props) {
  return (
    <div className="space-y-2 pt-1">
      {GOAL_TYPE_OPTIONS.map(({ value, emoji, label, desc }) => {
        const isSelected = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(
              isSelected ? selected.filter(t => t !== value) : [...selected, value]
            )}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
              isSelected
                ? 'border-primary bg-primary/8 text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            <span className="text-lg shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-xs opacity-70">{desc}</p>
            </div>
            <div className={`ml-auto h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
              isSelected ? 'bg-primary border-primary' : 'border-input'
            }`}>
              {isSelected && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
