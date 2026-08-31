import { cn } from '@/lib/utils'

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div className="bg-card border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(
        'text-2xl font-semibold mt-1',
        tone === 'warning' && 'text-amber-600 dark:text-amber-500',
        tone === 'danger' && 'text-destructive'
      )}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

export function StatSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  )
}
