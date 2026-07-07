import { SkHeader, SkStatCards, SkCardGrid } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="space-y-6">
        <SkStatCards n={4} />
        <SkCardGrid n={3} />
      </div>
    </>
  )
}
