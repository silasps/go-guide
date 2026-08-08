import { SkHeader, SkTable } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div>
      <SkHeader />
      <SkTable rows={8} cols={5} />
    </div>
  )
}
