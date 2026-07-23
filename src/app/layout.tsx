import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { NavigationProgress } from '@/components/navigation-progress'
import { SplashScreen } from '@/components/splash-screen'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return {
    title: {
      default: 'go→guide',
      template: '%s | go→guide',
    },
    description: t('description'),
    robots: { index: true, follow: true },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Preload dos frames de passo da splash — React 19 içça <link> pro <head>
            de onde quer que seja renderizado; evita pop-in quando a fase de
            caminhada começa (~900ms depois do primeiro paint). */}
        <link rel="preload" as="image" href="/splash/walk-1.png" />
        <link rel="preload" as="image" href="/splash/walk-2.png" />
        <link rel="preload" as="image" href="/splash/walk-3.png" />
        <SplashScreen />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <NavigationProgress />
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
