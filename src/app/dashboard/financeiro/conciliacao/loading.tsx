import { Sk, SkList } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <Sk className="h-3 w-64" />
      <SkList n={5} />
    </div>
  )
}
