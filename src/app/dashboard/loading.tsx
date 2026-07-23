import { Sk, SkStories, SkFeedPosts } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <SkStories />
      <Sk className="h-5 w-16" />
      <SkFeedPosts n={3} />
    </div>
  )
}
