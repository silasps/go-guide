import { LanguageSwitcher } from '@/components/marketing/language-switcher'

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed top-3 right-3 z-50">
        <LanguageSwitcher className="bg-background/90 backdrop-blur rounded-full ring-1 ring-foreground/10 shadow-sm p-1" />
      </div>
      {children}
    </>
  )
}
