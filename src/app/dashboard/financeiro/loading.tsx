import { SkStatCards, SkTable } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkStatCards n={3} />
      <SkTable rows={8} cols={5} />
    </div>
  )
}
