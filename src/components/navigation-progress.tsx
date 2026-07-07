'use client'

import NextTopLoader from 'nextjs-toploader'

export function NavigationProgress() {
  return (
    <NextTopLoader
      color="var(--primary)"
      initialPosition={0.12}
      crawlSpeed={150}
      height={3}
      crawl
      showSpinner={false}
      easing="ease"
      speed={300}
      shadow={false}
      zIndex={9999}
    />
  )
}
