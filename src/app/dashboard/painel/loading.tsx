import { Sk, SkStatCards, SkList } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <Sk className="h-16 w-full rounded-xl" />
      <Sk className="h-6 w-48" />
      <SkStatCards n={4} />
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <SkList n={3} />
        <div className="space-y-3">
          <Sk className="h-32 w-full rounded-xl" />
          <Sk className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
