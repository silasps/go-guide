import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HandHeart, Heart, MessageCircle } from 'lucide-react'

export async function ProfileCTA({ username, hasTrajectory = false }: { username: string; hasTrajectory?: boolean }) {
  const t = await getTranslations('PublicProfile')

  return (
    <div className="space-y-2">
      {/* Ações principais */}
      <div className="flex gap-3">
        <Link href={`/${username}/parceria`} className={cn(buttonVariants(), 'flex-1 gap-2')}>
          <HandHeart className="h-4 w-4" />
          {t('beAPartner')}
        </Link>
        <Link href={`/${username}/oracao`} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1 gap-2')}>
          <Heart className="h-4 w-4" />
          {t('sendPrayer')}
        </Link>
      </div>

      <Link href={`/${username}/mensagens`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-full gap-2 text-muted-foreground text-xs')}>
        <MessageCircle className="h-3.5 w-3.5" />
        {t('sendMessage')}
      </Link>

      {/* Links de navegação secundários */}
      <div className="flex gap-2">
        <Link href={`/${username}/projetos`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1 text-muted-foreground text-xs')}>
          {t('viewAllProjects')}
        </Link>
        <Link href={`/${username}/historia`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1 text-muted-foreground text-xs')}>
          {t('ourStory')}
        </Link>
        {hasTrajectory && (
          <Link href={`/${username}/trajetoria`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1 text-muted-foreground text-xs')}>
            {t('trajectory')}
          </Link>
        )}
      </div>
    </div>
  )
}
