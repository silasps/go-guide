import { SkHeader, SkList } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkHeader />
      <SkList n={6} />
    </div>
  )
}
