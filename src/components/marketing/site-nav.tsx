'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronDown, Menu, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_MODULES, MODULE_COLOR_CLASSES } from '@/lib/modules'
import { LanguageSwitcher } from './language-switcher'

export function SiteNav() {
  const tNav = useTranslations('Nav')
  const tModules = useTranslations('Modules')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileModulesOpen, setMobileModulesOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo.png" alt="Go guide" width={130} height={61} className="h-8 w-auto dark:hidden" priority />
          <Image src="/logo-white.png" alt="Go guide" width={130} height={61} className="h-8 w-auto hidden dark:block" priority />
        </Link>

        <div className="hidden md:flex items-center gap-1" ref={containerRef}>
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                open ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-expanded={open}
            >
              {tNav('modulos')}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[560px] rounded-xl border bg-popover shadow-lg ring-1 ring-foreground/10 p-4 grid grid-cols-2 gap-1">
                {APP_MODULES.map(({ id, icon: Icon, color }) => (
                  <Link
                    key={id}
                    href={`/#modulo-${id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', MODULE_COLOR_CLASSES[color])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{tModules(`${id}.title`)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tModules(`${id}.description`)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/planos" className="px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {tNav('planos')}
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <LanguageSwitcher className="hidden sm:flex mr-1" />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? tNav('fecharMenu') : tNav('abrirMenu')}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden md:inline-flex')}>{tNav('entrar')}</Link>
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'sm' }), 'hidden md:inline-flex')}>{tNav('criarConta')}</Link>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t px-6 py-4 space-y-1 bg-background max-h-[70vh] overflow-y-auto">
          <div className="flex sm:hidden items-center justify-center pb-3 mb-1 border-b">
            <LanguageSwitcher />
          </div>

          <button
            onClick={() => setMobileModulesOpen((v) => !v)}
            className="flex items-center justify-between w-full px-1 py-2 text-sm font-semibold"
            aria-expanded={mobileModulesOpen}
          >
            {tNav('modulos')}
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', mobileModulesOpen && 'rotate-180')} />
          </button>

          {mobileModulesOpen && APP_MODULES.map(({ id, icon: Icon, color }) => (
            <Link
              key={id}
              href={`/#modulo-${id}`}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', MODULE_COLOR_CLASSES[color])}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{tModules(`${id}.title`)}</span>
            </Link>
          ))}
          <Link
            href="/planos"
            onClick={() => setMobileOpen(false)}
            className="block px-2 py-2.5 mt-1 border-t text-sm font-medium text-foreground"
          >
            {tNav('planos')}
          </Link>

          <div className="flex items-center gap-2 pt-3 mt-2 border-t">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
            >
              {tNav('entrar')}
            </Link>
            <Link
              href="/cadastro"
              onClick={() => setMobileOpen(false)}
              className={cn(buttonVariants(), 'flex-1')}
            >
              {tNav('criarConta')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
