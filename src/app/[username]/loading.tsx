import { Sk, SkCardGrid } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Sk className="size-16 rounded-full shrink-0" />
        <div className="space-y-2">
          <Sk className="h-5 w-40" />
          <Sk className="h-3 w-56" />
        </div>
      </div>
      <SkCardGrid n={3} />
    </div>
  )
}
