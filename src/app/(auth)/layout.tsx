import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 gap-6">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">M</span>
        </div>
        <span className="font-semibold">go→guide</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
