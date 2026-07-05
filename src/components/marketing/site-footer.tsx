import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { APP_MODULES } from '@/lib/modules'

export async function SiteFooter() {
  const tFooter = await getTranslations('Footer')
  const tModules = await getTranslations('Modules')

  return (
    <footer className="px-6 py-12 border-t bg-muted/30">
      <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">M</span>
            </div>
            <span className="font-semibold text-sm">go→guide</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            {tFooter('tagline')}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground mb-3">{tFooter('modulosTitle')}</p>
          <ul className="space-y-2">
            {APP_MODULES.slice(0, 5).map((m) => (
              <li key={m.id}>
                <Link href={`/#modulo-${m.id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {tModules(`${m.id}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground mb-3">{tFooter('contaTitle')}</p>
          <ul className="space-y-2">
            <li><Link href="/planos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{tFooter('planos')}</Link></li>
            <li><Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{tFooter('entrar')}</Link></li>
            <li><Link href="/cadastro" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{tFooter('criarConta')}</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t text-xs text-muted-foreground">
        © {new Date().getFullYear()} go→guide
      </div>
    </footer>
  )
}
