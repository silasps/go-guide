import Link from 'next/link'
import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 gap-6">
      <Link href="/" className="shrink-0">
        <Image src="/logo.png" alt="Go guide" width={130} height={61} className="h-9 w-auto dark:hidden" priority />
        <Image src="/logo-white.png" alt="Go guide" width={130} height={61} className="h-9 w-auto hidden dark:block" priority />
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
