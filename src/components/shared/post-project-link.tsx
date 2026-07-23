import Image from 'next/image'
import Link from 'next/link'
import { FolderOpen, ChevronRight } from 'lucide-react'

interface Props {
  username: string
  highlight: { title: string; slug: string | null; cover_url: string | null }
}

export function PostProjectLink({ username, highlight }: Props) {
  return (
    <Link
      href={`/${username}/projetos/${highlight.slug ?? ''}`}
      className="flex items-center gap-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors px-2 py-1.5"
    >
      <div className="h-7 w-7 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {highlight.cover_url ? (
          <Image src={highlight.cover_url} alt="" width={28} height={28} className="h-full w-full object-cover" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      <span className="text-xs font-medium truncate flex-1">{highlight.title}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  )
}
